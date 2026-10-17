import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import type { AppConfig, UserConfig } from '../config/configuration';
import type { AuthUser } from './auth-user';

interface JwtPayload {
  username?: unknown;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;
/** Compared against for unknown users so timing doesn't reveal which exist. */
const DUMMY_HASH = bcrypt.hashSync('storify-dummy-password', 10);

export function isBcryptHash(value: string): boolean {
  return BCRYPT_PREFIX.test(value);
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit(): void {
    const plaintext = this.configService
      .get('users', { infer: true })
      .filter((u) => !isBcryptHash(u.password))
      .map((u) => u.username);
    if (plaintext.length > 0) {
      this.logger.warn(
        `Plaintext passwords for: ${plaintext.join(', ')}. Store bcrypt hashes instead (pnpm hash-password).`,
      );
    }
  }

  /**
   * USER_<NAME> may hold a bcrypt hash (recommended) or, for compatibility,
   * the plaintext password.
   */
  async validateUser(
    username: unknown,
    password: unknown,
  ): Promise<AuthUser | null> {
    if (typeof username !== 'string' || typeof password !== 'string') {
      return null;
    }
    const user = this.findUser(username);
    const stored = user?.password ?? DUMMY_HASH;
    let matches: boolean;
    if (isBcryptHash(stored)) {
      matches = await bcrypt.compare(password, stored);
    } else {
      // Fixed-length digests so the comparison time doesn't leak password
      // length or prefix matches.
      matches = timingSafeEqual(sha256(stored), sha256(password));
    }
    return user && matches ? this.toAuthUser(user) : null;
  }

  login(user: AuthUser): { access_token: string } {
    return { access_token: this.jwtService.sign({ username: user.username }) };
  }

  /**
   * Resolves the current user for a token payload. The role always comes from
   * configuration, never from the token, so role changes and removed users
   * take effect immediately.
   */
  userFromPayload(payload: JwtPayload): AuthUser | null {
    if (typeof payload.username !== 'string') return null;
    const user = this.findUser(payload.username);
    return user ? this.toAuthUser(user) : null;
  }

  /** Verifies a raw JWT (e.g. from a WebSocket handshake cookie). */
  verifyToken(token: string): AuthUser | null {
    try {
      return this.userFromPayload(this.jwtService.verify<JwtPayload>(token));
    } catch {
      return null;
    }
  }

  private findUser(username: string): UserConfig | undefined {
    return this.configService
      .get('users', { infer: true })
      .find((u) => u.username === username);
  }

  private toAuthUser(user: UserConfig): AuthUser {
    return { username: user.username, role: user.role };
  }
}
