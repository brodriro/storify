import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LlmService } from '../llm/llm.service';
import { FileSystemService } from '../../../filesystem/filesystem.service';
import { AdminService } from '../../../admin/admin.service';
import { LogsService } from '../logs/logs.service';
import { FileReaderService } from '../file-reader/file-reader.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true }) // Enable CORS for development
export class ChatGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly llmService: LlmService,
    private readonly fileSystemService: FileSystemService,
    private readonly adminService: AdminService,
    private readonly logsService: LogsService,
    private readonly fileReaderService: FileReaderService,
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

        case 'list_documents_by_name':
          // Assuming the message will contain the search term, e.g., "list documents named 'report'"
          const searchNameMatch = message.match(/(?:named|llamados)\s+['"]?([^'"]+)['"]?/i);
          const searchName = searchNameMatch ? searchNameMatch[1] : '';

          if (searchName) {
            // Assuming a default directory for now, could be made dynamic
            const matchingDocs = await this.fileReaderService.listDocumentsByName(searchName);
            response.action = { matchingDocs };
            response.response = matchingDocs.length > 0
              ? `I found these documents matching "${searchName}": ${matchingDocs.join(', ')}.`
              : `I could not find any documents matching "${searchName}".`;
          } else {
            response.response = 'Please provide a name to search for documents. E.g., "list documents named \'report\'"';
          }
          break;

        case 'summarize_document':
          // Assuming the message will contain the file path, e.g., "summarize file /path/to/document.pdf"
          const filePathMatch = message.match(/(?:archivo|documento)\s+(['"]?)(.*?)(['"]?)$/i);
          const filePath = filePathMatch ? filePathMatch[2] : '';

          if (filePath) {
            try {
              const fileContent = await this.fileReaderService.readFileContent(filePath);
              const summary = await this.llmService.summarizeText(fileContent);
              response.action = { summary };
              response.response = `Aquí esta el resumen de ${filePath}: ${summary}`;
            } catch (fileError) {
              Logger.error(`Error summarizing document ${filePath}: ${fileError.message}`, fileError.stack, 'ChatGateway');
              response.response = `I could not summarize the document at ${filePath}. It might be unreadable or an unsupported type.`;
              response.error = fileError.message;
            }
          } else {
            response.response = 'Please provide the path to the document you want to summarize. E.g., "summarize file /documents/report.pdf"';
          }
          break;

        default:
          if (intent === 'unknown') {
            response.response = 'I did not understand your request. Please try one of the following commands: disk usage, recent files, backup, or suspicious activity.';
          } else {
            response.response = 'I do not understand that request.';
          }
          break;
      }
    } catch (error) {
      this.logsService.error(`Error processing intent ${intent}: ${error.message}`, error.stack, 'ChatGateway');
      response.response = `An error occurred while processing your request for ${intent}.`;
      response.error = error.message;
    }

    // Generate human-like response using LLM
    const finalResponse = await this.llmService.generateResponse(message, response.intent, response);

    this.server.emit('chatResponse', { intent, action: response.action, response: finalResponse });
    this.logsService.log(`Sent chat response: ${JSON.stringify({ intent, action: response.intent, response: finalResponse })}`, 'ChatGateway');
  }
}
