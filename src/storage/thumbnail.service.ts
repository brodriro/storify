import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { AppConfig } from '../config/configuration';

/** Thumbnails older than this are pruned on startup; those still needed are regenerated on demand. */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export interface Thumbnail {
  /** Absolute path of the cached WebP file. */
  path: string;
  etag: string;
}

/**
 * Disk cache of WebP thumbnails under <STORAGE_PATH>/.thumbs (plan C3).
 *
 * The key hashes the source path, size and mtime, so an edited file gets a
 * new thumbnail and the old one is simply left to the startup prune. Callers
 * must pass an already-authorized path: there are no ACL checks here.
 */
@Injectable()
export class ThumbnailService implements OnModuleInit {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly cacheDir: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.cacheDir = path.join(
      configService.get('storagePath', { infer: true }),
      '.thumbs',
    );
  }

  async onModuleInit() {
    await fs.promises.mkdir(this.cacheDir, { recursive: true });
    await this.prune(Date.now() - MAX_AGE_MS);
  }

  async get(source: string, stats: fs.Stats): Promise<Thumbnail> {
    const key = createHash('sha256')
      .update(`${source}\0${stats.size}\0${stats.mtimeMs}`)
      .digest('hex')
      .slice(0, 32);
    const target = path.join(this.cacheDir, `${key}.webp`);
    const thumbnail = { path: target, etag: `"${key}"` };

    if (await this.isFile(target)) return thumbnail;

    // Written aside and renamed, so a concurrent request never reads half a file.
    const partial = `${target}.${randomUUID()}.partial`;
    try {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
      await sharp(source)
        .resize(300, 300, { fit: sharp.fit.inside, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(partial);
      await fs.promises.rename(partial, target);
    } finally {
      await fs.promises.rm(partial, { force: true });
    }
    return thumbnail;
  }

  /** Removes thumbnails (and leftover partials) last written before `cutoff`. */
  async prune(cutoff: number): Promise<number> {
    let removed = 0;
    let names: string[];
    try {
      names = await fs.promises.readdir(this.cacheDir);
    } catch {
      return 0;
    }
    for (const name of names) {
      const file = path.join(this.cacheDir, name);
      try {
        const { mtimeMs } = await fs.promises.stat(file);
        if (mtimeMs < cutoff || name.endsWith('.partial')) {
          await fs.promises.rm(file, { force: true });
          removed++;
        }
      } catch {
        // Removed concurrently: nothing to do.
      }
    }
    if (removed) this.logger.log(`Pruned ${removed} cached thumbnails`);
    return removed;
  }

  private async isFile(file: string): Promise<boolean> {
    try {
      return (await fs.promises.stat(file)).isFile();
    } catch {
      return false;
    }
  }
}
