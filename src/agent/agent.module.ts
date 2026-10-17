import { Module } from '@nestjs/common';
import { BackupModule } from '../backup/backup.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { AgentService } from './agent.service';
import { ClassificationModule } from './classification/classification.module';
import { DocumentReaderModule } from './documents/document-reader.module';
import { LlmModule } from './llm/llm.module';
import type { AgentTool } from './tools/agent-tool';
import { AGENT_TOOL_CLASSES } from './tools';
import { AGENT_TOOLS, ToolRegistry } from './tools/tool-registry';

@Module({
  imports: [
    LlmModule,
    BackupModule,
    AuditModule,
    StorageModule,
    DocumentReaderModule,
    ClassificationModule,
  ],
  providers: [
    ...AGENT_TOOL_CLASSES,
    {
      provide: AGENT_TOOLS,
      useFactory: (...tools: AgentTool[]) => tools,
      inject: AGENT_TOOL_CLASSES,
    },
    ToolRegistry,
    AgentService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
