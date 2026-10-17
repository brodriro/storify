import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AgentModule } from '../agent.module';
import { AuditModule } from '../../audit/audit.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AgentModule, AuthModule, AuditModule],
  providers: [ChatGateway],
})
export class ChatModule {}
