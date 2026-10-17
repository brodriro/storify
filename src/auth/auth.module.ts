import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { LogsModule } from '../agent/logs/logs.module';
import type { AppConfig } from '../config/configuration';
import { FileSystemModule } from '../filesystem/filesystem.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

import { SESSION_TTL_SECONDS } from './auth.constants';

@Module({
  imports: [
    FileSystemModule,
    LogsModule,
    // Login attempts: 10 per minute per IP + username (LoginThrottlerGuard).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.get('jwtSecret', { infer: true }),
        signOptions: { expiresIn: SESSION_TTL_SECONDS },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
