import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../config/configuration';
import type { AuthUser } from './auth-user';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          (request?.cookies as Record<string, string> | undefined)?.jwt ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwtSecret', { infer: true }),
    });
  }

  validate(payload: { username?: unknown }): AuthUser | false {
    return this.authService.userFromPayload(payload) ?? false;
  }
}
