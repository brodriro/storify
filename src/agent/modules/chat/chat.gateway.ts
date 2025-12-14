import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LogsService } from '../logs/logs.service';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service'; // Import AgentService

@WebSocketGateway({ cors: true }) // Enable CORS for development
export class ChatGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly logsService: LogsService,
    private readonly agentService: AgentService, // Inject AgentService
  ) {
    var historial = []
  }

  @SubscribeMessage('chat')
  async handleMessage(@MessageBody() message: string): Promise<void> {
    this.logsService.log(`Received chat message: ${message}`, 'ChatGateway');
    
    // Pass the message to the AgentService for processing
    const agentResponse = await this.agentService.processMessage(message);
    

    this.server.emit('chatResponse', { response: agentResponse.response });
    this.logsService.log(`Sent chat response: ${JSON.stringify(agentResponse)}`, 'ChatGateway');
  }
}
