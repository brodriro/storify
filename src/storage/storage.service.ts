import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthUser } from '../auth/auth-user';
import type { AppConfig } from '../config/configuration';
import {
  ensureDirectoryExists,
  resolveStoragePath,
} from '../common/path.utils';
import { mapWithConcurrency } from '../common/concurrency';
import { AccessPolicy, ResolvedPath } from './access-policy';
import { Thumbnail, ThumbnailService } from './thumbnail.service';

/** Parallel fs calls per request; see mapWithConcurrency. */
const FS_CONCURRENCY = 32;
/** Default cap for tree searches (recent files, name search). */
export const DEFAULT_FIND_LIMIT = 100;
const STATS_TTL_MS = 5 * 60 * 1000;

const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.heic',
  '.heif',
];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];
/** Raster formats sharp can turn into thumbnails (SVG is excluded on purpose). */
const THUMBNAIL_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tiff',
  '.heic',
  '.heif',
  '.bmp',
];

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  sizeMb: number;
  modifiedAt: Date;
  extension: string;
  isImage: boolean;
  isVideo: boolean;
}

export interface FoundFile {
  /** Path relative to the user's root, '/'-separated. */
  path: string;
  name: string;
  size: number;
  modifiedAt: Date;
  extension: string;
}

export interface GlobalStats {
  totalSize: number;
  totalFiles: number;
  fileTypes: Record<string, number>;
  /** Bytes per top-level folder under users/ ('OTROS' for root files). */
  userUsage: Record<string, number>;
}

export interface DiskUsage {
  /** Bytes stored under users/. */
  totalBytes: number;
  /** The filesystem holding STORAGE_PATH (free = available to this process). */
  volume: { sizeBytes: number; freeBytes: number };
}

export interface UploadedTempFile {
  path: string;
  originalname: string;
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}

@Injectable()
export class StorageService {
  private readonly baseStoragePath: string;
  private statsCache: { value: GlobalStats; at: number } | null = null;
  private statsInFlight: Promise<GlobalStats> | null = null;
  private statsGeneration = 0;

  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly policy: AccessPolicy,
    private readonly thumbnails: ThumbnailService,
  ) {
    this.baseStoragePath = configService.get('storagePath', { infer: true });
    ensureDirectoryExists(this.baseStoragePath);
    resolveStoragePath(this.baseStoragePath, 'users');
    resolveStoragePath(this.baseStoragePath, 'public');
  }

  getUserPath(username: string): string {
    return resolveStoragePath(this.baseStoragePath, 'users', username);
  }

  /** Resolves a path for reading by other modules (e.g. the agent). */
  async resolveReadableFile(user: AuthUser, relativePath: unknown) {
    const target = await this.policy.resolve(user, relativePath, 'read');
    await this.statFile(target);
    return target;
  }

  async listFiles(
    user: AuthUser,
    relativePath: unknown = '',
    sortBy: 'name' | 'date' = 'name',
    order: 'asc' | 'desc' = 'asc',
  ): Promise<FileEntry[]> {
    const dir = await this.policy.resolve(user, relativePath, 'read');

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir.absolute, {
        withFileTypes: true,
      });
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }

    const items = await mapWithConcurrency(
      entries.filter((entry) => this.policy.isVisible(user, dir, entry.name)),
      FS_CONCURRENCY,
      async (entry): Promise<FileEntry | null> => {
        try {
          const stats = await fs.promises.stat(
            path.join(dir.absolute, entry.name),
          );
          const isDirectory = stats.isDirectory();
          const extension = isDirectory
            ? ''
            : path.extname(entry.name).toLowerCase();
          const size = isDirectory ? 0 : stats.size;
          return {
            name: entry.name,
            isDirectory,
            size,
            sizeMb: isDirectory
              ? 0
              : Math.max(1, Math.round(size / (1024 * 1024))),
            modifiedAt: stats.mtime,
            extension,
            isImage: IMAGE_EXTENSIONS.includes(extension),
            isVideo: VIDEO_EXTENSIONS.includes(extension),
          };
        } catch (error) {
          // Entry vanished or is a dangling symlink: skip it.
          if (isNotFound(error)) return null;
          throw error;
        }
      },
    );

    return items
      .filter((item): item is FileEntry => item !== null)
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        const comparison =
          sortBy === 'date'
            ? a.modifiedAt.getTime() - b.modifiedAt.getTime()
            : a.name.localeCompare(b.name);
        return order === 'asc' ? comparison : -comparison;
      });
  }

  async createFolder(user: AuthUser, parentPath: unknown, folderName: unknown) {
    const parent = await this.policy.resolve(user, parentPath, 'write');
    const name = this.policy.assertValidName(user, parent, folderName);
    await fs.promises.mkdir(path.join(parent.absolute, name), {
      recursive: true,
    });
  }

  async handleUpload(
    user: AuthUser,
    file: UploadedTempFile,
    relativePath: unknown,
  ): Promise<string> {
    try {
      const dir = await this.policy.resolve(user, relativePath, 'write');
      const original = this.policy.assertValidName(
        user,
        dir,
        path.basename(file.originalname),
      );
      await fs.promises.mkdir(dir.absolute, { recursive: true });

      const ext = path.extname(original);
      const base = path.basename(original, ext);
      let finalName = original;
      for (let counter = 1; ; counter++) {
        try {
          // 'wx' fails if the name is taken, so concurrent uploads can't clash.
          await fs.promises
            .open(path.join(dir.absolute, finalName), 'wx')
            .then((handle) => handle.close());
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          finalName = `${base}_duplicado${counter > 1 ? counter : ''}${ext}`;
        }
      }

      await fs.promises.rename(file.path, path.join(dir.absolute, finalName));
      this.invalidateStats();
      return finalName;
    } finally {
      await fs.promises.rm(file.path, { force: true });
    }
  }

  /** Returns the absolute path of a readable regular file. */
  async downloadFile(user: AuthUser, relativePath: unknown): Promise<string> {
    const target = await this.policy.resolve(user, relativePath, 'read');
    await this.statFile(target);
    return target.absolute;
  }

  async getThumbnail(
    user: AuthUser,
    relativePath: unknown,
  ): Promise<Thumbnail> {
    const target = await this.policy.resolve(user, relativePath, 'read');
    const stats = await this.statFile(target);

    const ext = path.extname(target.absolute).toLowerCase();
    if (!THUMBNAIL_EXTENSIONS.includes(ext)) {
      throw new UnsupportedMediaTypeException(
        'No thumbnail for this file type',
      );
    }

    return this.thumbnails.get(target.absolute, stats);
  }

  async deleteItem(user: AuthUser, relativePath: unknown) {
    const target = await this.policy.resolve(user, relativePath, 'write');
    this.policy.assertMutable(user, target);
    await this.statExisting(target);
    try {
      await fs.promises.rm(target.absolute, { recursive: true, force: true });
    } finally {
      // Also after a partial failure: part of the tree may be gone.
      this.invalidateStats();
    }
  }

  async renameItem(user: AuthUser, currentPath: unknown, newName: unknown) {
    const source = await this.policy.resolve(user, currentPath, 'write');
    this.policy.assertMutable(user, source);
    const parent = await this.policy.resolve(
      user,
      source.segments.slice(0, -1).join('/'),
      'write',
    );
    const name = this.policy.assertValidName(user, parent, newName);

    await this.statExisting(source);
    const destination = path.join(parent.absolute, name);
    if (await this.exists(destination)) {
      throw new ConflictException('Target name already exists');
    }
    await fs.promises.rename(source.absolute, destination);
    // Renaming a top-level folder changes who the usage is attributed to.
    this.invalidateStats();
  }

  async moveItem(user: AuthUser, currentPath: unknown, destination: unknown) {
    const source = await this.policy.resolve(user, currentPath, 'write');
    this.policy.assertMutable(user, source);
    const destDir = await this.policy.resolve(user, destination, 'write');
    const name = source.segments[source.segments.length - 1];
    // Re-validate the final location (e.g. a top-level name reserved for a user).
    this.policy.assertValidName(user, destDir, name);

    if (
      destDir.relative === source.relative ||
      destDir.relative.startsWith(`${source.relative}/`)
    ) {
      throw new BadRequestException('Cannot move a folder into itself');
    }

    await this.statExisting(source);
    const destStats = await fs.promises
      .stat(destDir.absolute)
      .catch(() => null);
    if (!destStats?.isDirectory()) {
      throw new NotFoundException('Destination folder does not exist');
    }
    const finalDest = path.join(destDir.absolute, name);
    if (await this.exists(finalDest)) {
      throw new ConflictException('File with same name exists in destination');
    }
    await fs.promises.rename(source.absolute, finalDest);
    this.invalidateStats();
  }

  /**
   * Storage-wide statistics for the admin dashboard. Walking users/ is
   * O(total files), so the result is cached for STATS_TTL_MS, concurrent
   * callers share one walk, and every write through this service
   * invalidates it.
   */
  getGlobalStats(): Promise<GlobalStats> {
    if (this.statsCache && Date.now() - this.statsCache.at < STATS_TTL_MS) {
      return Promise.resolve(this.statsCache.value);
    }
    if (!this.statsInFlight) {
      const generation = this.statsGeneration;
      const run = this.computeGlobalStats()
        .then((value) => {
          // A write during the walk makes this result stale: don't keep it.
          if (generation === this.statsGeneration) {
            this.statsCache = { value, at: Date.now() };
          }
          return value;
        })
        .finally(() => {
          if (this.statsInFlight === run) this.statsInFlight = null;
        });
      this.statsInFlight = run;
    }
    return this.statsInFlight;
  }

  /** Storify's data size plus the real state of the volume behind it. */
  async getDiskUsage(): Promise<DiskUsage> {
    const [stats, volume] = await Promise.all([
      this.getGlobalStats(),
      fs.promises.statfs(this.baseStoragePath),
    ]);
    return {
      totalBytes: stats.totalSize,
      volume: {
        sizeBytes: volume.blocks * volume.bsize,
        freeBytes: volume.bavail * volume.bsize,
      },
    };
  }

  private invalidateStats() {
    this.statsGeneration++;
    this.statsCache = null;
    this.statsInFlight = null;
  }

  private async computeGlobalStats(): Promise<GlobalStats> {
    const root = path.join(this.baseStoragePath, 'users');
    const stats: GlobalStats = {
      totalSize: 0,
      totalFiles: 0,
      fileTypes: {},
      userUsage: {},
    };

    const processDir = async (dirPath: string, owner?: string) => {
      let items: fs.Dirent[];
      try {
        items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      const files = items.filter((item) => item.isFile());
      const sizes = await mapWithConcurrency(files, FS_CONCURRENCY, (item) =>
        fs.promises
          .stat(path.join(dirPath, item.name))
          .then(({ size }) => size)
          .catch((error: unknown) => {
            if (isNotFound(error)) return null;
            throw error;
          }),
      );
      files.forEach((item, i) => {
        const size = sizes[i];
        if (size === null) return;
        stats.totalSize += size;
        stats.totalFiles++;
        const ext = path.extname(item.name).toLowerCase() || 'unknown';
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        // Files directly in the shared root belong to no user
        const key = owner ?? 'OTROS';
        stats.userUsage[key] = (stats.userUsage[key] || 0) + size;
      });
      for (const item of items) {
        if (item.isDirectory()) {
          // Top-level folders under users/ are attributed to that name
          await processDir(path.join(dirPath, item.name), owner ?? item.name);
        }
      }
    };

    await processDir(root);
    return stats;
  }

  /** Readable files modified in the last `days` days, newest first. */
  async getRecentFiles(
    user: AuthUser,
    days = 7,
    limit = DEFAULT_FIND_LIMIT,
  ): Promise<FoundFile[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const files = await this.findFiles(user, {
      match: (file) => file.modifiedAt.getTime() > cutoff,
    });
    return files
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
      .slice(0, limit);
  }

  /** Readable files whose name contains `search` (case-insensitive). */
  async searchFiles(
    user: AuthUser,
    search: string,
    extensions?: string[],
    limit = DEFAULT_FIND_LIMIT,
  ): Promise<FoundFile[]> {
    const needle = search.toLowerCase();
    return this.findFiles(user, {
      matchName: (name, extension) =>
        name.toLowerCase().includes(needle) &&
        (!extensions || extensions.includes(extension)),
      limit,
    });
  }

  /**
   * Walks the user's readable tree. `matchName` filters before the stat call
   * (cheap); `match` sees the stats. With `limit`, the walk stops once that
   * many files matched.
   */
  private async findFiles(
    user: AuthUser,
    options: {
      matchName?: (name: string, extension: string) => boolean;
      match?: (file: FoundFile) => boolean;
      limit?: number;
    },
  ): Promise<FoundFile[]> {
    const { matchName, match, limit = Infinity } = options;
    const results: FoundFile[] = [];
    const walk = async (dir: ResolvedPath) => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir.absolute, {
          withFileTypes: true,
        });
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      const subdirs: ResolvedPath[] = [];
      const files: { child: ResolvedPath; extension: string }[] = [];
      for (const entry of entries) {
        // Symlinks are skipped so the walk can't leave the user's root.
        if (entry.isSymbolicLink()) continue;
        if (!this.policy.isVisible(user, dir, entry.name)) continue;
        const child: ResolvedPath = {
          absolute: path.join(dir.absolute, entry.name),
          relative: dir.relative ? `${dir.relative}/${entry.name}` : entry.name,
          segments: [...dir.segments, entry.name],
        };
        const extension = path.extname(entry.name).toLowerCase();
        if (entry.isDirectory()) subdirs.push(child);
        else if (
          entry.isFile() &&
          (!matchName || matchName(entry.name, extension))
        )
          files.push({ child, extension });
      }

      const found = await mapWithConcurrency(
        files,
        FS_CONCURRENCY,
        async ({ child, extension }): Promise<FoundFile | null> => {
          try {
            const stats = await fs.promises.stat(child.absolute);
            return {
              path: child.relative,
              name: child.segments[child.segments.length - 1],
              size: stats.size,
              modifiedAt: stats.mtime,
              extension,
            };
          } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
          }
        },
      );
      for (const file of found) {
        if (results.length >= limit) return;
        if (file && (!match || match(file))) results.push(file);
      }
      for (const subdir of subdirs) {
        if (results.length >= limit) return;
        await walk(subdir);
      }
    };
    await walk(await this.policy.resolve(user, '', 'read'));
    return results;
  }

  private async statFile(target: ResolvedPath): Promise<fs.Stats> {
    const stats = await this.statExisting(target);
    if (!stats.isFile()) throw new NotFoundException('File not found');
    return stats;
  }

  private async statExisting(target: ResolvedPath): Promise<fs.Stats> {
    try {
      return await fs.promises.stat(target.absolute);
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException('Item not found');
      throw error;
    }
  }

  private async exists(absolute: string): Promise<boolean> {
    try {
      await fs.promises.access(absolute);
      return true;
    } catch {
      return false;
    }
  }
}
