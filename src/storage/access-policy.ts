import { t } from '../i18n';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth-user';
import type { AppConfig } from '../config/configuration';

export type AccessMode = 'read' | 'write';

export interface ResolvedPath {
  /** Absolute path on disk. */
  absolute: string;
  /** Normalized path relative to the user's root, '/'-separated ('' = root). */
  relative: string;
  segments: string[];
}

const MAX_NAME_LENGTH = 255;

/**
 * Single source of truth for which paths a user may touch.
 *
 * Rules (docs/base.md):
 * - admin: everything under users/.
 * - member: everything under users/ except top-level folders named after
 *   another configured user.
 * - guest: read-only access to public/.
 * - Nobody may delete, rename or move a storage root; only admin may do it
 *   to a user's home folder.
 *
 * Paths are normalized before any rule is applied, so "ALICE/../ADMIN" is
 * judged as "ADMIN".
 */
@Injectable()
export class AccessPolicy {
  private readonly usersRoot: string;
  private readonly publicRoot: string;

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly auditService: AuditService,
  ) {
    const storage = path.resolve(
      configService.get('storagePath', { infer: true }),
    );
    this.usersRoot = path.join(storage, 'users');
    this.publicRoot = path.join(storage, 'public');
  }

  rootFor(user: AuthUser): string {
    return user.role === 'guest' ? this.publicRoot : this.usersRoot;
  }

  /** Resolves a user-supplied relative path, enforcing containment and ACL. */
  async resolve(
    user: AuthUser,
    relativePath: unknown,
    mode: AccessMode,
  ): Promise<ResolvedPath> {
    if (relativePath === undefined || relativePath === null) relativePath = '';
    if (typeof relativePath !== 'string' || relativePath.includes('\0')) {
      throw new BadRequestException(t('errors.invalidPath'));
    }

    const root = this.rootFor(user);
    // Leading slashes are treated as "relative to the user's root".
    const cleaned = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const absolute = path.resolve(root, cleaned);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      this.deny(user, relativePath);
    }
    const segments = relative === '' ? [] : relative.split(path.sep);

    if (!this.allows(user, segments, mode)) this.deny(user, relativePath);
    await this.assertNoSymlinkEscape(user, root, absolute, relativePath);

    return { absolute, relative: segments.join('/'), segments };
  }

  /** Extra checks for deleting, renaming or moving the item itself. */
  assertMutable(user: AuthUser, target: ResolvedPath): void {
    if (target.segments.length === 0) {
      this.deny(user, target.relative, t('errors.storageRootImmutable'));
    }
    if (
      target.segments.length === 1 &&
      user.role !== 'admin' &&
      this.isConfiguredUser(target.segments[0])
    ) {
      this.deny(user, target.relative, t('errors.userFolderImmutable'));
    }
  }

  /**
   * Validates a single file/folder name chosen by the user (new folder, rename
   * target, uploaded file) and keeps members from squatting another user's
   * home folder name at the top level.
   */
  assertValidName(user: AuthUser, parent: ResolvedPath, name: unknown): string {
    if (
      typeof name !== 'string' ||
      name.trim() === '' ||
      name === '.' ||
      name === '..' ||
      /[/\\\0]/.test(name) ||
      name.length > MAX_NAME_LENGTH
    ) {
      throw new BadRequestException(t('errors.invalidName'));
    }
    if (
      parent.segments.length === 0 &&
      user.role !== 'admin' &&
      this.isConfiguredUser(name) &&
      name !== user.username
    ) {
      this.deny(user, name, t('errors.reservedName'));
    }
    return name;
  }

  /**
   * Whether the user may write into an already-resolved folder. A plain rule
   * check for the UI (no exception, no security event); writes themselves
   * still go through resolve(..., 'write').
   */
  canWrite(user: AuthUser, target: ResolvedPath): boolean {
    return this.allows(user, target.segments, 'write');
  }

  /** Whether a directory entry should appear in a listing of `parent`. */
  isVisible(user: AuthUser, parent: ResolvedPath, entryName: string): boolean {
    if (entryName.startsWith('.')) return false;
    return this.allows(user, [...parent.segments, entryName], 'read');
  }

  private allows(
    user: AuthUser,
    segments: string[],
    mode: AccessMode,
  ): boolean {
    switch (user.role) {
      case 'admin':
        return true;
      case 'guest':
        return mode === 'read';
      case 'member': {
        const top = segments[0];
        return !(
          top !== undefined &&
          top !== user.username &&
          this.isConfiguredUser(top)
        );
      }
      default:
        return false;
    }
  }

  private isConfiguredUser(name: string): boolean {
    return this.configService
      .get('users', { infer: true })
      .some((u) => u.username === name);
  }

  /**
   * Rejects paths whose closest existing ancestor resolves (through symlinks)
   * outside the user's root.
   */
  private async assertNoSymlinkEscape(
    user: AuthUser,
    root: string,
    absolute: string,
    requested: string,
  ): Promise<void> {
    const realRoot = await fs.promises.realpath(root).catch(() => root);
    let candidate = absolute;
    for (;;) {
      try {
        const real = await fs.promises.realpath(candidate);
        const rel = path.relative(realRoot, real);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          this.deny(user, requested);
        }
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const parent = path.dirname(candidate);
        if (parent === candidate) return;
        candidate = parent;
      }
    }
  }

  private deny(user: AuthUser, requested: string, message?: string): never {
    void this.auditService.recordEvent('access_denied', {
      username: user.username,
      detail: requested.slice(0, 512),
    });
    throw new ForbiddenException(message ?? t('errors.accessDenied'));
  }
}
