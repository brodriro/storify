import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { StorageModule } from '../storage/storage.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [StorageModule, NotificationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
