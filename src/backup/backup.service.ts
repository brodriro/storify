import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import type { AppConfig } from '../config/configuration';
import { NotificationService } from '../notification/notification.service';

export type BackupKind = 'full' | 'incremental';

interface FileState {
  size: number;
  mtimeMs: number;
}

/** Written next to each finished ZIP: what it contains and what it is based on. */
export interface BackupManifest {
  name: string;
  kind: BackupKind;
  createdAt: number;
  /** Full backup an incremental chain belongs to. */
  baseFull: string | null;
  /** Complete file state at backup time ("users/..." -> size/mtime). */
  files: Record<string, FileState>;
  /** Paths in the archive (all for full; new/changed for incremental). */
  archived: string[];
  /** Files present in the previous backup and gone now (incremental only). */
  deleted: string[];
  sizeBytes: number;
}

export interface BackupSummary {
  name: string;
  kind: BackupKind;
  createdAt: number;
  sizeBytes: number;
  fileCount: number;
  deletedCount: number;
}

/** Already compressed: storing them avoids burning CPU for no gain. */
const STORE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
  '.avif',
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.mp3',
  '.aac',
  '.ogg',
  '.flac',
  '.zip',
  '.gz',
  '.tgz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.zst',
  '.docx',
  '.xlsx',
  '.pptx',
  '.pdf',
]);

const MANIFEST_SUFFIX = '.manifest.json';
const PARTIAL_SUFFIX = '.zip.partial';

/**
 * ZIP backups of <storage>/users.
 *
 * - Atomic: written to *.zip.partial and renamed when complete; a failed or
 *   interrupted run never replaces or deletes a good backup.
 * - Retention runs only after a full backup succeeded: keeps the newest
 *   `keepFull` full backups and the incrementals based on them.
 * - Incrementals record new/changed files and deletions against the
 *   previous backup's manifest, so restores don't resurrect deleted files.
 */
@Injectable()
export class BackupService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BackupService.name);
  private readonly usersDir: string;
  private readonly backupDir: string;
  private readonly keepFull: number;
  private readonly adminEmail: string;
  private running: { archive: archiver.Archiver; partial: string } | null =
    null;

  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly notificationService: NotificationService,
  ) {
    const storage = configService.get('storagePath', { infer: true });
    const backup = configService.get('backup', { infer: true });
    this.usersDir = path.join(storage, 'users');
    this.backupDir = backup.path;
    this.keepFull = backup.keepFull;
    this.adminEmail = configService.get('adminEmail', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    await fs.promises.mkdir(this.backupDir, { recursive: true });
    // Leftovers of runs interrupted by a crash are never valid backups.
    for (const name of await fs.promises.readdir(this.backupDir)) {
      if (name.endsWith(PARTIAL_SUFFIX)) {
        await fs.promises.rm(path.join(this.backupDir, name), { force: true });
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.running) return;
    this.logger.warn('Shutting down: aborting the backup in progress');
    this.running.archive.abort();
    await fs.promises.rm(this.running.partial, { force: true });
    this.running = null;
  }

  isRunning(): boolean {
    return this.running !== null;
  }

  /**
   * Starts a backup in the background. Returns false if one is running.
   * An incremental without a previous full backup becomes a full one.
   */
  async start(kind: BackupKind): Promise<boolean> {
    if (this.running) return false;
    const previous = (await this.readManifests())[0] ?? null;
    const effectiveKind: BackupKind =
      kind === 'incremental' && previous ? 'incremental' : 'full';

    const createdAt = Date.now();
    const name = `${effectiveKind}_backup-${createdAt}`;
    const partial = path.join(this.backupDir, `${name}${PARTIAL_SUFFIX}`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    this.running = { archive, partial };

    void this.run(effectiveKind, name, createdAt, partial, archive, previous)
      .catch(async (error: Error) => {
        this.logger.error(
          `Backup ${name} failed: ${error.message}`,
          error.stack,
        );
        await fs.promises.rm(partial, { force: true });
      })
      .finally(() => {
        if (this.running?.partial === partial) this.running = null;
      });
    return true;
  }

  async list(): Promise<BackupSummary[]> {
    return (await this.readManifests()).map((m) => ({
      name: m.name,
      kind: m.kind,
      createdAt: m.createdAt,
      sizeBytes: m.sizeBytes,
      fileCount: m.archived.length,
      deletedCount: m.deleted.length,
    }));
  }

  async lastBackupTimestamp(): Promise<number> {
    return (await this.readManifests())[0]?.createdAt ?? 0;
  }

  /** ZIP path of a backup by name, or the newest full backup by default. */
  async zipPath(name?: string): Promise<string> {
    const manifests = await this.readManifests();
    const match = name
      ? manifests.find((m) => m.name === name)
      : manifests.find((m) => m.kind === 'full');
    if (!match) throw new NotFoundException('No backup available');
    return path.join(this.backupDir, `${match.name}.zip`);
  }

  private async run(
    kind: BackupKind,
    name: string,
    createdAt: number,
    partial: string,
    archive: archiver.Archiver,
    previous: BackupManifest | null,
  ): Promise<void> {
    const files = await this.snapshot();
    const changed =
      kind === 'full' || !previous
        ? Object.keys(files)
        : Object.keys(files).filter((rel) => {
            const before = previous.files[rel];
            return (
              !before ||
              before.size !== files[rel].size ||
              before.mtimeMs !== files[rel].mtimeMs
            );
          });
    const deleted =
      kind === 'incremental' && previous
        ? Object.keys(previous.files).filter((rel) => !(rel in files))
        : [];

    const output = fs.createWriteStream(partial);
    const finished = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (warning) =>
        this.logger.warn(`Backup ${name}: ${warning.message}`),
      );
    });
    archive.pipe(output);
    for (const rel of changed) {
      const entry: archiver.ZipEntryData = {
        name: rel,
        store: STORE_EXTENSIONS.has(path.extname(rel).toLowerCase()),
      };
      archive.file(path.join(this.usersDir, rel.slice('users/'.length)), entry);
    }
    if (deleted.length > 0) {
      archive.append(deleted.join('\n') + '\n', { name: 'DELETED.txt' });
    }
    try {
      // finalize() never settles after a read error, so wait for both and let
      // the first failure win.
      await Promise.all([archive.finalize(), finished]);
    } catch (error) {
      archive.abort();
      output.destroy();
      throw error;
    }

    const zip = path.join(this.backupDir, `${name}.zip`);
    await fs.promises.rename(partial, zip);
    const manifest: BackupManifest = {
      name,
      kind,
      createdAt,
      baseFull: kind === 'full' ? name : (previous?.baseFull ?? null),
      files,
      archived: changed,
      deleted,
      sizeBytes: (await fs.promises.stat(zip)).size,
    };
    await fs.promises.writeFile(
      path.join(this.backupDir, `${name}${MANIFEST_SUFFIX}`),
      JSON.stringify(manifest),
    );
    this.logger.log(
      `Backup ${name} done: ${changed.length} files, ${deleted.length} deletions`,
    );

    if (kind === 'full') await this.applyRetention();
    await this.notificationService.sendEmail(
      this.adminEmail,
      kind === 'full' ? 'Full Backup Created' : 'Incremental Backup Created',
      `Backup ${name}.zip (${changed.length} files)`,
    );
  }

  /** Every regular file under users/ (symlinks are not followed). */
  private async snapshot(): Promise<Record<string, FileState>> {
    const files: Record<string, FileState> = {};
    const walk = async (dir: string, rel: string) => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        const entryRel = `${rel}/${entry.name}`;
        if (entry.isDirectory()) {
          await walk(abs, entryRel);
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(abs);
          files[entryRel] = { size: stats.size, mtimeMs: stats.mtimeMs };
        }
      }
    };
    await walk(this.usersDir, 'users');
    return files;
  }

  /** Manifests of finished backups, newest first. */
  private async readManifests(): Promise<BackupManifest[]> {
    let names: string[];
    try {
      names = await fs.promises.readdir(this.backupDir);
    } catch {
      return [];
    }
    const manifests: BackupManifest[] = [];
    for (const name of names.filter((n) => n.endsWith(MANIFEST_SUFFIX))) {
      try {
        const raw = await fs.promises.readFile(
          path.join(this.backupDir, name),
          'utf8',
        );
        manifests.push(JSON.parse(raw) as BackupManifest);
      } catch (error) {
        this.logger.warn(
          `Ignoring unreadable manifest ${name}: ${String(error)}`,
        );
      }
    }
    return manifests.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Keeps the newest `keepFull` full backups and the incrementals based on them. */
  private async applyRetention(): Promise<void> {
    const manifests = await this.readManifests();
    const keptFulls = new Set(
      manifests
        .filter((m) => m.kind === 'full')
        .slice(0, this.keepFull)
        .map((m) => m.name),
    );
    for (const m of manifests) {
      const keep =
        m.kind === 'full'
          ? keptFulls.has(m.name)
          : m.baseFull !== null && keptFulls.has(m.baseFull);
      if (keep) continue;
      this.logger.log(`Retention: removing backup ${m.name}`);
      await fs.promises.rm(path.join(this.backupDir, `${m.name}.zip`), {
        force: true,
      });
      await fs.promises.rm(
        path.join(this.backupDir, `${m.name}${MANIFEST_SUFFIX}`),
        { force: true },
      );
    }
  }
}
