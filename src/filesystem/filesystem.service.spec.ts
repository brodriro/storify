import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemService } from './filesystem.service';

/**
 * Access-control behaviour of FileSystemService.
 *
 * Tests marked `it.failing` document known vulnerabilities / spec gaps from the
 * improvement plan (S9, S9b and decision D1). They pass while the bug exists;
 * once the access policy is fixed Jest will report them as unexpectedly
 * passing, which is the signal to turn them into plain `it`.
 */
describe('FileSystemService access control', () => {
  let storage: string;
  let usersRoot: string;
  let publicRoot: string;
  let service: FileSystemService;

  const write = (root: string, rel: string, content = 'x') => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  beforeEach(() => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'storify-fs-'));
    usersRoot = path.join(storage, 'users');
    publicRoot = path.join(storage, 'public');

    const config = new ConfigService({
      storagePath: storage,
      users: [
        { username: 'ADMIN', roles: ['admin'] },
        { username: 'ALICE', roles: ['moderator'] },
        { username: 'BOB', roles: ['moderator'] },
        { username: 'INVITADO', roles: ['public'] },
      ],
    });
    service = new FileSystemService(config);

    write(usersRoot, 'ADMIN/secret.txt', 'admin-secret');
    write(usersRoot, 'ALICE/own.txt', 'alice');
    write(usersRoot, 'BOB/private.txt', 'bob');
    write(usersRoot, 'shared.txt', 'shared');
    write(publicRoot, 'readme.txt', 'public');
  });

  afterEach(() => {
    fs.rmSync(storage, { recursive: true, force: true });
  });

  describe('behaviour that is already correct', () => {
    it('lets admin download any user file', async () => {
      await expect(
        service.downloadFile('ADMIN', 'BOB/private.txt', 'admin'),
      ).resolves.toBe(path.join(usersRoot, 'BOB/private.txt'));
    });

    it('lets a member download their own file', async () => {
      await expect(
        service.downloadFile('ALICE', 'ALICE/own.txt', 'moderator'),
      ).resolves.toBe(path.join(usersRoot, 'ALICE/own.txt'));
    });

    it('blocks a member from the ADMIN folder by direct path', async () => {
      await expect(
        service.downloadFile('ALICE', 'ADMIN/secret.txt', 'moderator'),
      ).rejects.toThrow();
    });

    it('blocks escaping the storage root', async () => {
      await expect(
        service.downloadFile('ALICE', '../../etc/passwd', 'moderator'),
      ).rejects.toThrow();
    });

    it('hides other users folders from a guest listing', async () => {
      const items = await service.listFiles('INVITADO', '', 'guest');
      expect(items.map((i) => i.name)).toEqual(['readme.txt']);
    });
  });

  describe('S9: ACL bypass with ".." inside the path', () => {
    it.failing(
      'blocks a member reaching ADMIN through their own folder',
      async () => {
        await expect(
          service.downloadFile(
            'ALICE',
            'ALICE/../ADMIN/secret.txt',
            'moderator',
          ),
        ).rejects.toThrow();
      },
    );

    it.failing('blocks renaming a file into the ADMIN folder', async () => {
      await expect(
        service.renameItem(
          'ALICE',
          'ALICE/own.txt',
          '../ADMIN/planted.txt',
          'moderator',
        ),
      ).rejects.toThrow();
    });
  });

  describe('S9b: deleting a storage root', () => {
    it.failing.each(['', '.', './', 'ALICE/..'])(
      'never lets a member delete the users root via %j',
      async (target) => {
        await service
          .deleteItem('ALICE', target, 'moderator')
          .catch(() => undefined);
        expect(fs.existsSync(path.join(usersRoot, 'ADMIN/secret.txt'))).toBe(
          true,
        );
      },
    );

    it.failing('rejects a guest deleting the public root', async () => {
      await expect(
        service.deleteItem('INVITADO', '', 'guest'),
      ).rejects.toThrow();
    });
  });

  describe('D1: members only see their own folder (spec)', () => {
    it.failing('blocks a member reading another member folder', async () => {
      await expect(
        service.downloadFile('ALICE', 'BOB/private.txt', 'moderator'),
      ).rejects.toThrow();
    });

    it.failing('hides other members folders at the root', async () => {
      const items = await service.listFiles('ALICE', '', 'moderator');
      expect(items.map((i) => i.name)).not.toContain('BOB');
    });

    it.failing('treats the guest as read-only', async () => {
      await expect(
        service.deleteItem('INVITADO', 'readme.txt', 'guest'),
      ).rejects.toThrow();
    });
  });
});
