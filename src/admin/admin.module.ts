import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FileSystemModule } from '../filesystem/filesystem.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [FileSystemModule, NotificationModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
