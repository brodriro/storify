import { Module } from '@nestjs/common';
import { FileSystemService } from './filesystem.service';
import { FileSystemController } from './filesystem.controller';

@Module({
    controllers: [FileSystemController],
    providers: [FileSystemService],
    exports: [FileSystemService],
})
export class FileSystemModule { }
