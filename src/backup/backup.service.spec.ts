import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AppConfig } from '../config/configuration';
import type { NotificationService } from '../notification/notification.service';
import { BackupService, type BackupManifest } from './backup.service';

describe('BackupService (C5)', () => {
  let storage: string;
  let backupDir: string;
  let service: BackupService;

  const write = (rel: string, content = 'x') => {
    const full = path.join(storage, 'users', rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  const make = (keepFull = 3) => {
    const config = new ConfigService({
      storagePath: storage,
      adminEmail: 'admin@test',
      backup: { path: backupDir, keepFull },
    }) as unknown as ConfigService<AppConfig, true>;
    const notifications = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;
    return new BackupService(config, notifications);
  };

  /** Starts a backup and waits for the background run to finish. */
  async function backup(kind: 'full' | 'incremental', svc = service) {
    expect(await svc.start(kind)).toBe(true);
    const started = Date.now();
    while (svc.isRunning()) {
      if (Date.now() - started > 10_000) throw new Error('backup timed out');
      await new Promise((r) => setTimeout(r, 10));
    }
    // Distinct timestamps for names created in the same millisecond.
    await new Promise((r) => setTimeout(r, 5));
  }

  const manifests = (): BackupManifest[] =>
    fs
      .readdirSync(backupDir)
      .filter((n) => n.endsWith('.manifest.json'))
      .map(
        (n) =>
          JSON.parse(
            fs.readFileSync(path.join(backupDir, n), 'utf8'),
          ) as BackupManifest,
      )
      .sort((a, b) => a.createdAt - b.createdAt);

  beforeEach(async () => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'storify-backup-'));
    backupDir = path.join(storage, 'backups');
    write('ALICE/a.txt', 'alice');
    write('BOB/photo.jpg', 'jpeg-bytes');
    service = make();
    await service.onModuleInit();
  });

  afterEach(() => {
    fs.rmSync(storage, { recursive: true, force: true });
  });

  it('writes a complete zip plus manifest and no partial file', async () => {
    await backup('full');
    const [m] = manifests();
    expect(m.kind).toBe('full');
    expect(m.archived.sort()).toEqual([
      'users/ALICE/a.txt',
      'users/BOB/photo.jpg',
    ]);
    const files = fs.readdirSync(backupDir);
    expect(files.some((f) => f.endsWith('.partial'))).toBe(false);
    const zip = fs.readFileSync(path.join(backupDir, `${m.name}.zip`));
    expect(zip.includes('users/ALICE/a.txt')).toBe(true);
    expect(m.sizeBytes).toBe(zip.length);
  });

  it('records changed, new and deleted files in incrementals', async () => {
    await backup('full');
    write('ALICE/a.txt', 'alice v2 (longer)');
    write('ALICE/new.txt', 'new');
    fs.rmSync(path.join(storage, 'users/BOB/photo.jpg'));
    await backup('incremental');

    const inc = manifests()[1];
    expect(inc.kind).toBe('incremental');
    expect(inc.archived.sort()).toEqual([
      'users/ALICE/a.txt',
      'users/ALICE/new.txt',
    ]);
    expect(inc.deleted).toEqual(['users/BOB/photo.jpg']);
    expect(inc.baseFull).toBe(manifests()[0].name);
  });

  it('turns an incremental without a previous backup into a full one', async () => {
    await backup('incremental');
    expect(manifests()[0].kind).toBe('full');
  });

  it('downloads the newest full backup by default', async () => {
    await backup('full');
    await backup('incremental');
    const full = manifests()[0].name;
    expect(path.basename(await service.zipPath())).toBe(`${full}.zip`);
  });

  it('keeps the newest N full backups and their incrementals', async () => {
    const svc = make(2);
    await backup('full', svc);
    await backup('incremental', svc);
    await backup('full', svc);
    await backup('full', svc);

    const kinds = manifests().map((m) => m.kind);
    expect(kinds).toEqual(['full', 'full']);
    const zips = fs.readdirSync(backupDir).filter((f) => f.endsWith('.zip'));
    expect(zips).toHaveLength(2);
  });

  it('keeps previous backups when a new one fails', async () => {
    await backup('full');
    const before = fs.readdirSync(backupDir).sort();

    // The ZIP cannot be written (a full or unmounted disk). This fails for
    // any user; the old chmod 000 on a source file does not stop root, so
    // the backup succeeded in containers and the test failed.
    // The module object itself: `import * as fs` is a read-only wrapper.
    const nodeFs = jest.requireActual<typeof fs>('fs');
    const realCreateWriteStream = nodeFs.createWriteStream;
    const spy = jest
      .spyOn(nodeFs, 'createWriteStream')
      .mockImplementation(() =>
        realCreateWriteStream(path.join(storage, 'missing', 'backup.zip')),
      );
    try {
      await backup('full');
    } finally {
      spy.mockRestore();
    }

    expect(fs.readdirSync(backupDir).sort()).toEqual(before);
  });

  it('refuses a second backup while one is running', async () => {
    expect(await service.start('full')).toBe(true);
    expect(await service.start('full')).toBe(false);
    while (service.isRunning()) await new Promise((r) => setTimeout(r, 10));
  });

  it('removes partial files left by a crash on startup', async () => {
    fs.writeFileSync(path.join(backupDir, 'full_backup-1.zip.partial'), 'x');
    await make().onModuleInit();
    expect(fs.readdirSync(backupDir)).toEqual([]);
  });
});
