import { Module } from '@nestjs/common';
import { BackupModule } from '../backup/backup.module';
import { StorageModule } from '../storage/storage.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [StorageModule, BackupModule],
  controllers: [AdminController],
})
export class AdminModule {}
