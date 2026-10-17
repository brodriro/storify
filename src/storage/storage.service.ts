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
import sharp from 'sharp';
import type { AuthUser } from '../auth/auth-user';
import type { AppConfig } from '../config/configuration';
import {
  ensureDirectoryExists,
  resolveStoragePath,
} from '../common/path.utils';
import { AccessPolicy, ResolvedPath } from './access-policy';

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

  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly policy: AccessPolicy,
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

    const items = await Promise.all(
      entries
        .filter((entry) => this.policy.isVisible(user, dir, entry.name))
        .map(async (entry): Promise<FileEntry | null> => {
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
        }),
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

  async getThumbnail(user: AuthUser, relativePath: unknown): Promise<Buffer> {
    const target = await this.policy.resolve(user, relativePath, 'read');
    await this.statFile(target);

    const ext = path.extname(target.absolute).toLowerCase();
    if (!THUMBNAIL_EXTENSIONS.includes(ext)) {
      throw new UnsupportedMediaTypeException(
        'No thumbnail for this file type',
      );
    }

    return sharp(target.absolute)
      .resize(300, 300, { fit: sharp.fit.inside, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  }

  async deleteItem(user: AuthUser, relativePath: unknown) {
    const target = await this.policy.resolve(user, relativePath, 'write');
    this.policy.assertMutable(user, target);
    await this.statExisting(target);
    await fs.promises.rm(target.absolute, { recursive: true, force: true });
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
  }

  /** Storage-wide statistics for the admin dashboard. */
  async getGlobalStats() {
    const root = path.join(this.baseStoragePath, 'users');
    const stats = {
      totalSize: 0,
      totalFiles: 0,
      fileTypes: {} as Record<string, number>,
      userUsage: {} as Record<string, number>,
    };

    const processDir = async (dirPath: string, owner?: string) => {
      let items: fs.Dirent[];
      try {
        items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          // Top-level folders under users/ are attributed to that name
          await processDir(fullPath, owner ?? item.name);
        } else if (item.isFile()) {
          const { size } = await fs.promises.stat(fullPath);
          stats.totalSize += size;
          stats.totalFiles++;
          const ext = path.extname(item.name).toLowerCase() || 'unknown';
          stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
          // Files directly in the shared root belong to no user
          const key = owner ?? 'OTROS';
          stats.userUsage[key] = (stats.userUsage[key] || 0) + size;
        }
      }
    };

    await processDir(root);
    return stats;
  }

  async getDiskUsage(): Promise<{ totalBytes: number }> {
    const stats = await this.getGlobalStats();
    return { totalBytes: stats.totalSize };
  }

  /** Files modified in the last `days` days that the user can read. */
  async getRecentFiles(user: AuthUser, days = 7): Promise<FoundFile[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.findFiles(user, (file) => file.modifiedAt.getTime() > cutoff);
  }

  /** Readable files whose name contains `search` (case-insensitive). */
  async searchFiles(
    user: AuthUser,
    search: string,
    extensions?: string[],
  ): Promise<FoundFile[]> {
    const needle = search.toLowerCase();
    return this.findFiles(
      user,
      (file) =>
        file.name.toLowerCase().includes(needle) &&
        (!extensions || extensions.includes(file.extension)),
    );
  }

  private async findFiles(
    user: AuthUser,
    predicate: (file: FoundFile) => boolean,
  ): Promise<FoundFile[]> {
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
      for (const entry of entries) {
        // Symlinks are skipped so the walk can't leave the user's root.
        if (entry.isSymbolicLink()) continue;
        if (!this.policy.isVisible(user, dir, entry.name)) continue;
        const child: ResolvedPath = {
          absolute: path.join(dir.absolute, entry.name),
          relative: dir.relative ? `${dir.relative}/${entry.name}` : entry.name,
          segments: [...dir.segments, entry.name],
        };
        if (entry.isDirectory()) {
          await walk(child);
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(child.absolute);
          const file: FoundFile = {
            path: child.relative,
            name: entry.name,
            size: stats.size,
            modifiedAt: stats.mtime,
            extension: path.extname(entry.name).toLowerCase(),
          };
          if (predicate(file)) results.push(file);
        }
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
