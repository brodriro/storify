import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import type { AuthUser } from '../../auth/auth-user';
import { AuthService } from '../../auth/auth.service';
import { AgentService } from '../agent.service';
import { ChatMessage } from '../interfaces/ChatMessage';
import { AuditService } from '../../audit/audit.service';

/** Messages kept per socket (user + assistant turns). */
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Same-origin only: no CORS configuration on purpose.
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly conversationHistory = new Map<string, ChatMessage[]>();

  constructor(
    private readonly auditService: AuditService,
    private readonly agentService: AgentService,
    private readonly authService: AuthService,
  ) {}

  /** Authenticates the socket with the same JWT cookie as the HTTP session. */
  handleConnection(client: Socket): void {
    const token = readCookie(client.handshake.headers.cookie, 'jwt');
    const user = token ? this.authService.verifyToken(token) : null;
    if (!user) {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
      return;
    }
    (client.data as { user?: AuthUser }).user = user;
  }

  handleDisconnect(client: Socket): void {
    this.conversationHistory.delete(client.id);
  }

  @SubscribeMessage('chat')
  async handleMessage(
    @MessageBody() message: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = (client.data as { user?: AuthUser }).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    if (typeof message !== 'string' || message.trim() === '') return;
    const text = message.slice(0, MAX_MESSAGE_LENGTH);

    this.auditService.log(
      `Chat message from ${user.username} (${text.length} chars)`,
      ChatGateway.name,
    );

    const history = this.conversationHistory.get(client.id) ?? [];
    let response: string;
    try {
      // History holds previous turns only; the agent adds the new message.
      ({ response } = await this.agentService.processMessage(
        text,
        [...history],
        user,
      ));
    } catch (error) {
      this.logger.error(
        `Agent failed for ${user.username}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      response =
        error instanceof ServiceUnavailableException
          ? 'El asistente está desactivado en este servidor (falta configurar OPENAI_API_KEY).'
          : 'Lo siento, no he podido procesar tu petición en este momento. Inténtalo de nuevo.';
    }

    history.push(
      { role: 'user', content: text },
      { role: 'assistant', content: response },
    );
    this.conversationHistory.set(
      client.id,
      history.slice(-MAX_HISTORY_MESSAGES),
    );

    // Reply only to the asking socket, never broadcast.
    client.emit('chatResponse', { response });
  }
}
