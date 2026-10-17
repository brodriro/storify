import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth-user';
import type { AppConfig } from '../config/configuration';
import { AccessPolicy } from './access-policy';
import { StorageService } from './storage.service';
import { ThumbnailService } from './thumbnail.service';

const ADMIN: AuthUser = { username: 'ADMIN', role: 'admin' };
const ALICE: AuthUser = { username: 'ALICE', role: 'member' };
const GUEST: AuthUser = { username: 'INVITADO', role: 'guest' };

/**
 * Access control of the file API (plan: A1, S9, S9b, D1 = spec roles).
 * Runs against a real temp directory so path normalization and symlinks are
 * exercised for real.
 */
describe('StorageService access control', () => {
  let storage: string;
  let usersRoot: string;
  let publicRoot: string;
  let service: StorageService;
  let recordEvent: jest.Mock;

  const write = (root: string, rel: string, content = 'x') => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  const exists = (root: string, rel: string) =>
    fs.existsSync(path.join(root, rel));

  beforeEach(() => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'storify-fs-'));
    usersRoot = path.join(storage, 'users');
    publicRoot = path.join(storage, 'public');

    const config = new ConfigService({
      storagePath: storage,
      users: [
        { username: 'ADMIN', role: 'admin' },
        { username: 'ALICE', role: 'member' },
        { username: 'BOB', role: 'member' },
        { username: 'INVITADO', role: 'guest' },
      ],
    }) as unknown as ConfigService<AppConfig, true>;
    recordEvent = jest.fn().mockResolvedValue(undefined);
    const logs = { recordEvent } as unknown as AuditService;
    service = new StorageService(
      config,
      new AccessPolicy(config, logs),
      new ThumbnailService(config),
    );

    write(usersRoot, 'ADMIN/secret.txt', 'admin-secret');
    write(usersRoot, 'ALICE/own.txt', 'alice');
    write(usersRoot, 'BOB/private.txt', 'bob');
    write(usersRoot, 'Compartido/team.txt', 'team');
    write(usersRoot, 'shared.txt', 'shared');
    write(publicRoot, 'readme.txt', 'public');
  });

  afterEach(() => {
    fs.rmSync(storage, { recursive: true, force: true });
  });

  describe('admin', () => {
    it('downloads any user file', async () => {
      await expect(
        service.downloadFile(ADMIN, 'BOB/private.txt'),
      ).resolves.toBe(path.join(usersRoot, 'BOB/private.txt'));
    });

    it('cannot delete the users root', async () => {
      await expect(service.deleteItem(ADMIN, '.')).rejects.toThrow(
        'storage root',
      );
      expect(exists(usersRoot, 'ADMIN/secret.txt')).toBe(true);
    });
  });

  describe('member (spec: own folder + shared root)', () => {
    it('reads their own files, the shared root and global folders', async () => {
      await expect(
        service.downloadFile(ALICE, 'ALICE/own.txt'),
      ).resolves.toBeDefined();
      await expect(
        service.downloadFile(ALICE, 'shared.txt'),
      ).resolves.toBeDefined();
      await expect(
        service.downloadFile(ALICE, 'Compartido/team.txt'),
      ).resolves.toBeDefined();
    });

    it.each(['BOB/private.txt', 'ADMIN/secret.txt'])(
      'cannot read %s',
      async (target) => {
        await expect(service.downloadFile(ALICE, target)).rejects.toThrow(
          'Access denied',
        );
      },
    );

    it('only sees their own user folder at the root', async () => {
      const names = (await service.listFiles(ALICE, '')).map((i) => i.name);
      expect(names).toEqual(['ALICE', 'Compartido', 'shared.txt']);
    });

    it('records denied accesses as security events', async () => {
      await service.downloadFile(ALICE, 'BOB/private.txt').catch(() => null);
      expect(recordEvent).toHaveBeenCalledWith('access_denied', {
        username: 'ALICE',
        detail: 'BOB/private.txt',
      });
    });
  });

  describe('path traversal (S9)', () => {
    it.each([
      'ALICE/../ADMIN/secret.txt',
      'ALICE/../BOB/private.txt',
      './ALICE/../../users/BOB/private.txt',
      '../../etc/passwd',
      '..\\..\\etc\\passwd',
    ])('rejects %j', async (target) => {
      await expect(service.downloadFile(ALICE, target)).rejects.toThrow();
    });

    it('treats a leading slash as relative to the user root', async () => {
      await expect(service.downloadFile(ALICE, '/ALICE/own.txt')).resolves.toBe(
        path.join(usersRoot, 'ALICE/own.txt'),
      );
    });

    it('rejects NUL bytes', async () => {
      await expect(
        service.downloadFile(ALICE, 'ALICE/own.txt\0.png'),
      ).rejects.toThrow('Invalid path');
    });

    it('rejects symlinks that point outside the root', async () => {
      fs.symlinkSync('/etc', path.join(usersRoot, 'ALICE/escape'));
      await expect(
        service.downloadFile(ALICE, 'ALICE/escape/hostname'),
      ).rejects.toThrow('Access denied');
    });

    it('rejects renaming a file into another user folder', async () => {
      await expect(
        service.renameItem(ALICE, 'ALICE/own.txt', '../ADMIN/planted.txt'),
      ).rejects.toThrow('Invalid name');
      expect(exists(usersRoot, 'ADMIN/planted.txt')).toBe(false);
    });

    it('rejects moving into another user folder', async () => {
      await expect(
        service.moveItem(ALICE, 'ALICE/own.txt', 'BOB'),
      ).rejects.toThrow('Access denied');
      expect(exists(usersRoot, 'ALICE/own.txt')).toBe(true);
    });

    it('rejects squatting another user folder name at the root', async () => {
      await expect(
        service.createFolder(ALICE, '', 'CAROL'),
      ).resolves.toBeUndefined();
      await expect(service.createFolder(ALICE, '', 'BOB')).rejects.toThrow();
    });
  });

  describe('storage roots (S9b)', () => {
    it.each(['', '.', './', 'ALICE/..', '/'])(
      'never lets a member delete the users root via %j',
      async (target) => {
        await expect(service.deleteItem(ALICE, target)).rejects.toThrow();
        expect(exists(usersRoot, 'ADMIN/secret.txt')).toBe(true);
      },
    );

    it('does not let a member delete their own home folder', async () => {
      await expect(service.deleteItem(ALICE, 'ALICE')).rejects.toThrow(
        'User folders',
      );
    });

    it('rejects moving a folder into itself', async () => {
      await expect(
        service.moveItem(ALICE, 'Compartido', 'Compartido'),
      ).rejects.toThrow('into itself');
    });
  });

  describe('guest (spec: read-only public/)', () => {
    it('lists and downloads public files', async () => {
      const names = (await service.listFiles(GUEST, '')).map((i) => i.name);
      expect(names).toEqual(['readme.txt']);
      await expect(service.downloadFile(GUEST, 'readme.txt')).resolves.toBe(
        path.join(publicRoot, 'readme.txt'),
      );
    });

    it.each([
      [
        'delete a file',
        (s: StorageService) => s.deleteItem(GUEST, 'readme.txt'),
      ],
      ['delete the root', (s: StorageService) => s.deleteItem(GUEST, '')],
      [
        'create a folder',
        (s: StorageService) => s.createFolder(GUEST, '', 'x'),
      ],
      [
        'rename a file',
        (s: StorageService) => s.renameItem(GUEST, 'readme.txt', 'x.txt'),
      ],
    ])('cannot %s', async (_label, run) => {
      await expect(run(service)).rejects.toThrow('Access denied');
      expect(exists(publicRoot, 'readme.txt')).toBe(true);
    });

    it('cannot reach users/ from public/', async () => {
      await expect(
        service.downloadFile(GUEST, '../users/ADMIN/secret.txt'),
      ).rejects.toThrow('Access denied');
    });
  });

  describe('storage statistics (P2)', () => {
    it('attributes usage to top-level folders', async () => {
      const stats = await service.getGlobalStats();
      expect(stats.totalFiles).toBe(5);
      expect(stats.userUsage).toMatchObject({
        ADMIN: 'admin-secret'.length,
        ALICE: 'alice'.length,
        OTROS: 'shared'.length,
      });
    });

    it('caches the walk until a write goes through the service', async () => {
      const before = await service.getGlobalStats();
      // Written behind the service's back: not seen until the cache expires.
      write(usersRoot, 'ALICE/external.txt', 'external');
      expect(await service.getGlobalStats()).toBe(before);

      await service.deleteItem(ALICE, 'ALICE/own.txt');
      const after = await service.getGlobalStats();
      expect(after.totalFiles).toBe(before.totalFiles); // -own +external
      expect(after.userUsage.ALICE).toBe('external'.length);
    });

    it('shares one walk between concurrent callers', async () => {
      const readdir = jest.spyOn(fs.promises, 'readdir');
      const [a, b] = await Promise.all([
        service.getGlobalStats(),
        service.getGlobalStats(),
      ]);
      expect(a).toBe(b);
      const walksOfRoot = readdir.mock.calls.filter(
        ([dir]) => dir === usersRoot,
      );
      expect(walksOfRoot).toHaveLength(1);
      readdir.mockRestore();
    });

    it('summarizes against TOTAL_STORAGE_GB when set, else the volume', async () => {
      const volume = await service.getStorageSummary();
      expect(volume.totalBytes).toBeGreaterThan(0);
      expect(volume.percent).toBeGreaterThanOrEqual(0);

      const config = new ConfigService({
        storagePath: storage,
        storageLimitBytes: 100,
        users: [],
      }) as unknown as ConfigService<AppConfig, true>;
      const limited = new StorageService(
        config,
        new AccessPolicy(config, { recordEvent } as unknown as AuditService),
        new ThumbnailService(config),
      );
      // Fixtures: 'admin-secret' + 'alice' + 'bob' + 'team' + 'shared' = 30 bytes
      expect(await limited.getStorageSummary()).toEqual({
        usedBytes: 30,
        totalBytes: 100,
        percent: 30,
      });
    });

    it('reports the volume behind STORAGE_PATH', async () => {
      const usage = await service.getDiskUsage();
      expect(usage.totalBytes).toBeGreaterThan(0);
      expect(usage.volume.sizeBytes).toBeGreaterThan(0);
      expect(usage.volume.freeBytes).toBeLessThanOrEqual(
        usage.volume.sizeBytes,
      );
    });
  });

  describe('upload storage limit (TOTAL_STORAGE_GB)', () => {
    const fixturesBytes =
      'admin-secret'.length +
      'alice'.length +
      'bob'.length +
      'team'.length +
      'shared'.length;
    const withLimit = (limit: number | null) => {
      const config = new ConfigService({
        storagePath: storage,
        storageLimitBytes: limit,
        users: [{ username: 'ALICE', role: 'member' }],
      }) as unknown as ConfigService<AppConfig, true>;
      const logs = { recordEvent } as unknown as AuditService;
      return new StorageService(
        config,
        new AccessPolicy(config, logs),
        new ThumbnailService(config),
      );
    };
    const tempFile = (name: string, bytes: number) => {
      const file = path.join(storage, `${name}.upload`);
      fs.writeFileSync(file, Buffer.alloc(bytes));
      return { path: file, originalname: name, size: bytes };
    };

    it('accepts uploads up to the limit', async () => {
      const limited = withLimit(fixturesBytes + 10);
      await expect(
        limited.handleUpload(ALICE, tempFile('ten.bin', 10), 'ALICE'),
      ).resolves.toBe('ten.bin');
      expect(exists(usersRoot, 'ALICE/ten.bin')).toBe(true);
    });

    it('rejects an upload that would exceed it with 507 and drops the temp file', async () => {
      const limited = withLimit(fixturesBytes + 10);
      const file = tempFile('big.bin', 11);
      await expect(
        limited.handleUpload(ALICE, file, 'ALICE'),
      ).rejects.toMatchObject({
        status: 507,
      });
      expect(fs.existsSync(file.path)).toBe(false);
      expect(exists(usersRoot, 'ALICE/big.bin')).toBe(false);
    });

    it('counts concurrent uploads against each other', async () => {
      const limited = withLimit(fixturesBytes + 10);
      const results = await Promise.allSettled([
        limited.handleUpload(ALICE, tempFile('a.bin', 6), 'ALICE'),
        limited.handleUpload(ALICE, tempFile('b.bin', 6), 'ALICE'),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
    });

    it('sees space freed by a delete', async () => {
      const limited = withLimit(fixturesBytes);
      await expect(
        limited.handleUpload(ALICE, tempFile('one.bin', 1), 'ALICE'),
      ).rejects.toMatchObject({ status: 507 });
      await limited.deleteItem(ALICE, 'ALICE/own.txt');
      await expect(
        limited.handleUpload(ALICE, tempFile('one.bin', 1), 'ALICE'),
      ).resolves.toBe('one.bin');
    });

    it('does not limit uploads when TOTAL_STORAGE_GB is unset', async () => {
      const unlimited = withLimit(null);
      await expect(
        unlimited.handleUpload(ALICE, tempFile('huge.bin', 1000), 'ALICE'),
      ).resolves.toBe('huge.bin');
    });
  });

  describe('search and recent files', () => {
    it('only returns files the user can read, as relative paths', async () => {
      const found = await service.searchFiles(ALICE, '.txt');
      expect(found.map((f) => f.path).sort()).toEqual([
        'ALICE/own.txt',
        'Compartido/team.txt',
        'shared.txt',
      ]);
      const recent = await service.getRecentFiles(ALICE, 1);
      expect(recent.map((f) => f.path)).not.toContain('BOB/private.txt');
    });

    it('returns recent files newest first, up to the limit', async () => {
      // Future mtimes so they sort ahead of the fixtures written "now".
      const dir = path.join(usersRoot, 'ALICE');
      for (const [name, minutesAhead] of [
        ['old.txt', 10],
        ['newest.txt', 30],
        ['middle.txt', 20],
      ] as const) {
        const file = path.join(dir, name);
        fs.writeFileSync(file, name);
        const time = new Date(Date.now() + minutesAhead * 60_000);
        fs.utimesSync(file, time, time);
      }
      const recent = await service.getRecentFiles(ALICE, 1, 2);
      expect(recent.map((f) => f.path)).toEqual([
        'ALICE/newest.txt',
        'ALICE/middle.txt',
      ]);
    });

    it('stops searching once the limit is reached', async () => {
      const found = await service.searchFiles(ALICE, '.txt', undefined, 1);
      expect(found).toHaveLength(1);
    });
  });
});
