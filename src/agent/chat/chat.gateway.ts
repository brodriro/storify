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
import {
  AgentService,
  type AgentTurn,
  type PendingRun,
} from '../agent.service';
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

/** A proposed mutating action expires if not answered in time. */
const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

interface ParkedRun {
  run: PendingRun;
  expiresAt: number;
}

// Same-origin only: no CORS configuration on purpose.
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly conversationHistory = new Map<string, ChatMessage[]>();
  /** At most one action awaiting confirmation per socket. */
  private readonly pending = new Map<string, ParkedRun>();

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
    // Lets the UI tell users where their prompts and documents are sent (D3).
    client.emit('chatInfo', {
      enabled: this.agentService.isEnabled(),
      provider: this.agentService.providerLabel(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.conversationHistory.delete(client.id);
    this.pending.delete(client.id);
  }

  @SubscribeMessage('chat')
  async handleMessage(
    @MessageBody() message: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = this.userOf(client);
    if (!user) return;
    if (typeof message !== 'string' || message.trim() === '') return;
    const text = message.slice(0, MAX_MESSAGE_LENGTH);

    this.auditService.log(
      `Chat message from ${user.username} (${text.length} chars)`,
      ChatGateway.name,
    );

    // A new message abandons any action still waiting for confirmation.
    this.pending.delete(client.id);

    const history = this.conversationHistory.get(client.id) ?? [];
    // History holds previous turns only; the agent adds the new message.
    const turn = await this.runSafely(user, () =>
      this.agentService.processMessage(text, [...history], user),
    );
    this.remember(client.id, history, text, turn.response);
    this.reply(client, turn);
  }

  @SubscribeMessage('confirmAction')
  async handleConfirmation(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = this.userOf(client);
    if (!user) return;
    const { id, approved } = (body ?? {}) as {
      id?: unknown;
      approved?: unknown;
    };
    const parked = this.pending.get(client.id);
    if (!parked || parked.run.confirmation.id !== id) {
      client.emit('chatResponse', {
        response: 'Esa acción ya no está pendiente.',
      });
      return;
    }
    this.pending.delete(client.id);
    if (Date.now() > parked.expiresAt) {
      client.emit('chatResponse', {
        response: 'La confirmación ha caducado. Vuelve a pedírmelo si quieres.',
      });
      return;
    }

    const accepted = approved === true;
    this.auditService.log(
      `${user.username} ${accepted ? 'approved' : 'declined'} ${parked.run.confirmation.actions.map((a) => a.tool).join(', ')}`,
      ChatGateway.name,
    );
    const turn = await this.runSafely(user, () =>
      this.agentService.resolveConfirmation(parked.run, accepted, user),
    );
    const history = this.conversationHistory.get(client.id) ?? [];
    this.remember(
      client.id,
      history,
      accepted ? 'Confirmo la acción.' : 'Cancelo la acción.',
      turn.response,
    );
    this.reply(client, turn);
  }

  private userOf(client: Socket): AuthUser | null {
    const user = (client.data as { user?: AuthUser }).user;
    if (!user) client.disconnect(true);
    return user ?? null;
  }

  private async runSafely(
    user: AuthUser,
    run: () => Promise<AgentTurn>,
  ): Promise<AgentTurn> {
    try {
      return await run();
    } catch (error) {
      this.logger.error(
        `Agent failed for ${user.username}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        response:
          error instanceof ServiceUnavailableException
            ? 'El asistente está desactivado en este servidor (falta configurar un proveedor de IA).'
            : 'Lo siento, no he podido procesar tu petición en este momento. Inténtalo de nuevo.',
      };
    }
  }

  private remember(
    socketId: string,
    history: ChatMessage[],
    userText: string,
    response: string,
  ): void {
    history.push(
      { role: 'user', content: userText },
      { role: 'assistant', content: response },
    );
    this.conversationHistory.set(
      socketId,
      history.slice(-MAX_HISTORY_MESSAGES),
    );
  }

  /** Replies only to the asking socket, never broadcast. */
  private reply(client: Socket, turn: AgentTurn): void {
    if (turn.pending) {
      this.pending.set(client.id, {
        run: turn.pending,
        expiresAt: Date.now() + CONFIRMATION_TTL_MS,
      });
    }
    client.emit('chatResponse', {
      response: turn.response,
      ...(turn.confirmation ? { confirmation: turn.confirmation } : {}),
    });
  }
}
