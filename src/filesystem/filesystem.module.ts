import { Module } from '@nestjs/common';
import { FileSystemService } from './filesystem.service';
import { FileSystemController } from './filesystem.controller';
import { ClassificationModule } from '../agent/classification/classification.module';

@Module({
    imports: [ClassificationModule],
    controllers: [FileSystemController],
    providers: [FileSystemService],
    exports: [FileSystemService],
})
export class FileSystemModule { }
