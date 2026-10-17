import { Module } from '@nestjs/common';
import { DocumentReaderService } from './document-reader.service';

@Module({
  providers: [DocumentReaderService],
  exports: [DocumentReaderService],
})
export class DocumentReaderModule {}
