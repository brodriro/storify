import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { LlmModule } from  './llm/llm.module';
import { AdminModule } from 'src/admin/admin.module';
import { LogsModule } from './logs/logs.module';
import { FileSystemModule } from 'src/filesystem/filesystem.module';
import { FileReaderModule } from './file-reader/file-reader.module';

@Module({
  imports: [LlmModule, AdminModule, LogsModule, FileSystemModule, FileReaderModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
