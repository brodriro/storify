import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FileSystemModule } from '../filesystem/filesystem.module';

@Module({
    imports: [FileSystemModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
