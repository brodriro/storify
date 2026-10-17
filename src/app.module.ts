import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';
import { LlmModule } from './agent/llm/llm.module';
import { AuditModule } from './audit/audit.module';
import { ChatModule } from './agent/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AuthModule,
    FilesModule,
    AdminModule,
    LlmModule,
    AuditModule,
    ChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
