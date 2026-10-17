import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { DocumentReaderModule } from '../documents/document-reader.module';
import { LlmModule } from '../llm/llm.module';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './classification.service';

@Module({
  imports: [LlmModule, DocumentReaderModule, StorageModule],
  controllers: [ClassificationController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
