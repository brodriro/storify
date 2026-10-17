import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import * as path from 'path';
import { LogsModule } from '../agent/logs/logs.module';
import type { AppConfig } from '../config/configuration';
import { ensureDirectoryExists } from '../shared/utils/path.utils';
import { AccessPolicy } from './access-policy';
import { FileSystemController } from './filesystem.controller';
import { FileSystemService } from './filesystem.service';

@Module({
  imports: [
    LogsModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        // Temp uploads live on the same volume as the storage so the final
        // rename can't fail with EXDEV; dot-prefixed so listings hide it.
        const dest = path.join(
          config.get('storagePath', { infer: true }),
          '.tmp',
        );
        ensureDirectoryExists(dest);
        const upload = config.get('upload', { infer: true });
        return {
          dest,
          limits: {
            fileSize: upload.maxFileSizeMb * 1024 * 1024,
            files: upload.maxFiles,
          },
        };
      },
    }),
  ],
  controllers: [FileSystemController],
  providers: [FileSystemService, AccessPolicy],
  exports: [FileSystemService, AccessPolicy],
})
export class FileSystemModule {}
