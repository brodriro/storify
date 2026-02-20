import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, ConnectedSocket } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LogsService } from '../logs/logs.service';
import { Logger } from '@nestjs/common';
import { AgentService } from '../../agent/agent.service'; // Import AgentService
import { Socket } from 'socket.io';
import { ChatMessage } from 'src/agent/interfaces/ChatMessage';

@WebSocketGateway({ cors: true }) // Enable CORS for development
export class ChatGateway {
  @WebSocketServer() server: Server;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor(
    private readonly logsService: LogsService,
    private readonly agentService: AgentService, // Inject AgentService
  ) {}

  @SubscribeMessage('chat')
  async handleMessage(@MessageBody() message: string, @ConnectedSocket() client: Socket): Promise<void> {
    this.logsService.log(`Received chat message: ${message}`, 'ChatGateway');

    const sessionId = client.id;
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    const history = this.conversationHistory.get(sessionId);
    if (!history) {
      throw new Error('Conversation history not found for session');
    }
    history.push({ role: 'user', content: message });

    // Pass the message and history to the AgentService for processing
    const agentResponse = await this.agentService.processMessage(message, history);

    // Store agent's response in history
    history.push({ role: 'assistant', content: agentResponse.response });
   
    this.server.emit('chatResponse', { response: agentResponse.response }); // Emit the response back to the client
    this.logsService.log(`Sent chat response: ${JSON.stringify(agentResponse)}`, 'ChatGateway');
  }
}
