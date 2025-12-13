import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { LlmModule } from '../llm/llm.module';
import { FileSystemModule } from '../../../filesystem/filesystem.module';
import { AdminModule } from '../../../admin/admin.module';
import { LogsModule } from '../logs/logs.module';
import { FileReaderModule } from '../file-reader/file-reader.module';

@Module({
  imports: [LlmModule, FileSystemModule, AdminModule, LogsModule, FileReaderModule],
  providers: [ChatGateway],
})
export class ChatModule {}
