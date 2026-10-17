import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import type { AppConfig } from '../config/configuration';
import { ThumbnailService } from './thumbnail.service';

describe('ThumbnailService (C3)', () => {
  let storage: string;
  let service: ThumbnailService;
  let image: string;

  const writeImage = (file: string, width: number) =>
    sharp({
      create: { width, height: 400, channels: 3, background: '#3366cc' },
    })
      .png()
      .toFile(file);

  beforeEach(async () => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'storify-thumbs-'));
    const config = new ConfigService({
      storagePath: storage,
    }) as unknown as ConfigService<AppConfig, true>;
    service = new ThumbnailService(config);
    await service.onModuleInit();
    image = path.join(storage, 'photo.png');
    await writeImage(image, 1200);
  });

  afterEach(() => {
    fs.rmSync(storage, { recursive: true, force: true });
  });

  it('writes a WebP of at most 300 px under .thumbs', async () => {
    const thumb = await service.get(image, fs.statSync(image));
    expect(path.dirname(thumb.path)).toBe(path.join(storage, '.thumbs'));
    const meta = await sharp(thumb.path).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(300);
  });

  it('reuses the cached file until the source changes', async () => {
    const first = await service.get(image, fs.statSync(image));
    const writtenAt = fs.statSync(first.path).mtimeMs;
    const again = await service.get(image, fs.statSync(image));
    expect(again).toEqual(first);
    expect(fs.statSync(again.path).mtimeMs).toBe(writtenAt);

    await writeImage(image, 900);
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(image, future, future);
    const edited = await service.get(image, fs.statSync(image));
    expect(edited.etag).not.toBe(first.etag);
  });

  it('prunes old thumbnails and leftover partials', async () => {
    const thumb = await service.get(image, fs.statSync(image));
    const partial = path.join(storage, '.thumbs', 'x.webp.1.partial');
    fs.writeFileSync(partial, '');
    expect(await service.prune(0)).toBe(1);
    expect(fs.existsSync(partial)).toBe(false);
    expect(fs.existsSync(thumb.path)).toBe(true);

    expect(await service.prune(Date.now() + 1000)).toBe(1);
    expect(fs.existsSync(thumb.path)).toBe(false);
  });
});
