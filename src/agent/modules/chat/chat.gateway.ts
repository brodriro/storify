import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LlmService } from '../llm/llm.service';
import { FileSystemService } from '../../../filesystem/filesystem.service';
import { AdminService } from '../../../admin/admin.service';
import { LogsService } from '../logs/logs.service';

@WebSocketGateway({ cors: true }) // Enable CORS for development
export class ChatGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly llmService: LlmService,
    private readonly fileSystemService: FileSystemService,
    private readonly adminService: AdminService,
    private readonly logsService: LogsService,
  ) {}

  @SubscribeMessage('chat')
  async handleMessage(@MessageBody() message: string): Promise<void> {
    this.logsService.log(`Received chat message: ${message}`, 'ChatGateway');
    const { intent } = await this.llmService.getIntent(message);
    this.logsService.log(`Detected intent: ${intent}`, 'ChatGateway');

    let response: any = { intent, action: {}, response: '' };

    try {
      switch (intent) {
        case 'disk_usage':
          const { totalBytes } = await this.fileSystemService.getDiskUsage();
          response.action = { totalBytes };
          response.response = `Current disk usage is ${totalBytes} bytes.`;
          break;
        case 'recent_files':
          const recentFiles = await this.fileSystemService.getRecentFiles(); // Default to 7 days
          response.action = { recentFiles };
          response.response = `Found ${recentFiles.length} recent files.`;
          break;
        case 'backup_incremental':
          const backupStarted = await this.adminService.createBackup(true);
          response.action = { backupStarted };
          response.response = backupStarted ? 'Incremental backup started.' : 'Backup already in progress.';
          break;
        case 'suspicious_activity':
          const suspiciousLogs = this.logsService.getSuspiciousActivity();
          response.action = { suspiciousLogs };
          response.response = `Found ${suspiciousLogs.length} suspicious log entries.`;
          break;
        default:
          response.response = 'I do not understand that request.';
          break;
      }
    } catch (error) {
      this.logsService.error(`Error processing intent ${intent}: ${error.message}`, error.stack, 'ChatGateway');
      response.response = `An error occurred while processing your request for ${intent}.`;
      response.error = error.message;
    }

    this.server.emit('chatResponse', response);
    this.logsService.log(`Sent chat response: ${JSON.stringify(response)}`, 'ChatGateway');
  }
}
