import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AgentModule } from '../agent.module';
import { LogsModule } from '../logs/logs.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AgentModule, AuthModule, LogsModule],
  providers: [ChatGateway],
})
export class ChatModule {}
