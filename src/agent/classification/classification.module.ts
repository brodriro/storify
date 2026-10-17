import { Module } from '@nestjs/common';
import { FileSystemModule } from '../../filesystem/filesystem.module';
import { FileReaderModule } from '../file-reader/file-reader.module';
import { LlmModule } from '../llm/llm.module';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './classification.service';

@Module({
  imports: [LlmModule, FileReaderModule, FileSystemModule],
  controllers: [ClassificationController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
