import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import * as path from 'path';
import type { AppConfig } from '../config/configuration';
import { ensureDirectoryExists } from '../common/path.utils';
import { FilesController } from './files.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    StorageModule,
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
  controllers: [FilesController],
})
export class FilesModule {}
