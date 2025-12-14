import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { FileSystemModule } from './filesystem/filesystem.module';
import { AdminModule } from './admin/admin.module';
import { LlmModule } from './agent/modules/llm/llm.module';
import { LogsModule } from './agent/modules/logs/logs.module';
import { ChatModule } from './agent/modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AuthModule,
    FileSystemModule,
    AdminModule,
    LlmModule,
    LogsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
