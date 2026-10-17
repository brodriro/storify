import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import type { AppConfig, UserConfig } from '../config/configuration';
import type { AuthUser } from './auth-user';

interface JwtPayload {
  username?: unknown;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService,
  ) {}

  validateUser(username: unknown, password: unknown): AuthUser | null {
    if (typeof username !== 'string' || typeof password !== 'string') {
      return null;
    }
    const user = this.findUser(username);
    // Compare fixed-length digests so the comparison time doesn't leak
    // password length or prefix matches.
    const expected = sha256(user?.password ?? '');
    const matches = timingSafeEqual(expected, sha256(password));
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
