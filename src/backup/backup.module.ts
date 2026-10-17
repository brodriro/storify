import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { BackupService } from './backup.service';

@Module({
  imports: [NotificationModule],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
