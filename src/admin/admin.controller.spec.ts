import type { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/auth-user';
import type { BackupService, BackupSummary } from '../backup/backup.service';
import type { AppConfig } from '../config/configuration';
import type { StorageService } from '../storage/storage.service';
import { AdminController } from './admin.controller';

const admin: AuthUser = { username: 'ADMIN', role: 'admin' };

function backup(i: number, kind: 'full' | 'incremental'): BackupSummary {
  return {
    name: `backup_${i}.zip`,
    kind,
    createdAt: Date.UTC(2026, 9, 18, 12, i),
    sizeBytes: 2048 * (i + 1),
    fileCount: i + 1,
    deletedCount: 0,
  };
}

function controller(opts: {
  backups: BackupSummary[];
  running?: boolean;
  percent?: number;
  limitBytes?: number | null;
}) {
  const storage = {
    getGlobalStats: jest.fn().mockResolvedValue({
      totalSize: 3 * 1024 * 1024,
      totalFiles: 7,
      fileTypes: { '.jpg': 5, '.pdf': 2 },
      userUsage: { ALICE: 3 * 1024 * 1024 },
    }),
    getStorageSummary: jest.fn().mockResolvedValue({
      usedBytes: 50 * 1024 ** 3,
      totalBytes: 100 * 1024 ** 3,
      percent: opts.percent ?? 50,
    }),
  } as unknown as StorageService;
  const backups = {
    list: jest.fn().mockResolvedValue(opts.backups),
    isRunning: jest.fn().mockReturnValue(opts.running ?? false),
  } as unknown as BackupService;
  const config = {
    get: jest.fn().mockReturnValue(opts.limitBytes ?? null),
  } as unknown as ConfigService<AppConfig, true>;
  return new AdminController(storage, backups, config);
}

describe('AdminController.dashboard', () => {
  it('lists the 10 newest backups with a download link each, and counts the rest', async () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      backup(i, i % 3 === 0 ? 'full' : 'incremental'),
    );
    const view = await controller({ backups: list }).dashboard(admin);

    expect(view.backups).toHaveLength(10);
    expect(view.backupsHidden).toBe(2);
    expect(view.backups[0]).toMatchObject({
      name: 'backup_0.zip',
      isFull: true,
      sizeLabel: '2 KB',
      fileCount: 1,
      downloadUrl: '/admin/backup/download?name=backup_0.zip',
    });
    expect(view.backups[1].isFull).toBe(false);
  });

  it('encodes backup names in the download URL', async () => {
    const odd = { ...backup(1, 'full'), name: 'copia & más.zip' };
    const view = await controller({ backups: [odd] }).dashboard(admin);
    expect(view.backups[0].downloadUrl).toBe(
      '/admin/backup/download?name=copia%20%26%20m%C3%A1s.zip',
    );
  });

  it('reports a running backup so the page disables the button and polls', async () => {
    const view = await controller({ backups: [], running: true }).dashboard(
      admin,
    );
    expect(view.backupRunning).toBe(true);
    expect(view.backups).toEqual([]);
    expect(view.backupsHidden).toBe(0);
  });

  it.each([
    [50, 'ok'],
    [80, 'warning'],
    [95, 'critical'],
  ])('marks a %i %% full volume as %s', async (percent, level) => {
    const view = await controller({ backups: [], percent }).dashboard(admin);
    expect(view.storage.level).toBe(level);
  });

  it('says whether the storage limit is enforced', async () => {
    const free = await controller({ backups: [] }).dashboard(admin);
    const limited = await controller({
      backups: [],
      limitBytes: 100 * 1024 ** 3,
    }).dashboard(admin);
    expect(free.limitEnforced).toBe(false);
    expect(limited.limitEnforced).toBe(true);
  });
});
