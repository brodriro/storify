import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { LlmModule } from './llm/llm.module';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentReaderModule } from './documents/document-reader.module';
import { ClassificationModule } from './classification/classification.module';

@Module({
  imports: [
    LlmModule,
    AdminModule,
    AuditModule,
    StorageModule,
    DocumentReaderModule,
    ClassificationModule,
  ],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
