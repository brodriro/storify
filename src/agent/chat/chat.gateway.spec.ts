import type { Socket } from 'socket.io';
import type { AuthService } from '../../auth/auth.service';
import type { AgentService } from '../agent.service';
import type { AuditService } from '../../audit/audit.service';
import { ChatGateway } from './chat.gateway';

function fakeSocket(cookie?: string) {
  return {
    id: 'socket-1',
    data: {} as Record<string, unknown>,
    handshake: { headers: cookie ? { cookie } : {} },
    disconnect: jest.fn(),
    emit: jest.fn(),
  };
}

describe('ChatGateway', () => {
  const verifyToken = jest.fn();
  const processMessage = jest.fn();
  const resolveConfirmation = jest.fn();
  let gateway: ChatGateway;

  beforeEach(() => {
    verifyToken.mockReset();
    processMessage.mockReset();
    resolveConfirmation.mockReset();
    gateway = new ChatGateway(
      { log: jest.fn() } as unknown as AuditService,
      {
        processMessage,
        resolveConfirmation,
        isEnabled: () => true,
        providerLabel: () => 'OpenAI',
      } as unknown as AgentService,
      { verifyToken } as unknown as AuthService,
    );
  });

  it('disconnects sockets without a session cookie (S1)', () => {
    const socket = fakeSocket();
    gateway.handleConnection(socket as unknown as Socket);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects sockets with an invalid token', () => {
    verifyToken.mockReturnValue(null);
    const socket = fakeSocket('other=1; jwt=bad');
    gateway.handleConnection(socket as unknown as Socket);
    expect(verifyToken).toHaveBeenCalledWith('bad');
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('runs the agent as the socket user and replies only to that socket (S3, S5)', async () => {
    const alice = { username: 'ALICE', role: 'member' };
    verifyToken.mockReturnValue(alice);
    processMessage.mockResolvedValue({ response: 'hola' });
    const socket = fakeSocket('jwt=good');

    gateway.handleConnection(socket as unknown as Socket);
    await gateway.handleMessage(
      '¿cuánto espacio?',
      socket as unknown as Socket,
    );

    expect(processMessage).toHaveBeenCalledWith('¿cuánto espacio?', [], alice);
    expect(socket.emit).toHaveBeenCalledWith('chatResponse', {
      response: 'hola',
    });
  });

  it('answers with an error message instead of hanging when the agent fails', async () => {
    verifyToken.mockReturnValue({ username: 'ALICE', role: 'member' });
    processMessage.mockRejectedValue(new Error('LLM down'));
    const socket = fakeSocket('jwt=good');

    gateway.handleConnection(socket as unknown as Socket);
    await gateway.handleMessage('hola', socket as unknown as Socket);

    const [event, payload] = socket.emit.mock.calls.at(-1) as [
      string,
      { response: unknown },
    ];
    expect(event).toBe('chatResponse');
    expect(typeof payload.response).toBe('string');
  });

  it('passes previous turns once, without duplicating the new message', async () => {
    verifyToken.mockReturnValue({ username: 'ALICE', role: 'member' });
    processMessage.mockResolvedValue({ response: 'r' });
    const socket = fakeSocket('jwt=good');
    gateway.handleConnection(socket as unknown as Socket);

    await gateway.handleMessage('uno', socket as unknown as Socket);
    await gateway.handleMessage('dos', socket as unknown as Socket);

    expect(processMessage).toHaveBeenLastCalledWith(
      'dos',
      [
        { role: 'user', content: 'uno' },
        { role: 'assistant', content: 'r' },
      ],
      expect.anything(),
    );
  });

  it('tells the client which AI provider receives the data (D3)', () => {
    verifyToken.mockReturnValue({ username: 'ALICE', role: 'member' });
    const socket = fakeSocket('jwt=good');
    gateway.handleConnection(socket as unknown as Socket);
    expect(socket.emit).toHaveBeenCalledWith('chatInfo', {
      enabled: true,
      provider: 'OpenAI',
    });
  });

  describe('confirmation of mutating actions (D2)', () => {
    const alice = { username: 'ALICE', role: 'member' };
    const confirmation = {
      id: 'c-1',
      actions: [{ tool: 'move_file', summary: 'Mover a' }],
    };
    const pending = { confirmation, messages: [], calls: [], iterations: 1 };

    async function proposeAction() {
      verifyToken.mockReturnValue(alice);
      processMessage.mockResolvedValue({
        response: 'Necesito tu confirmación',
        confirmation,
        pending,
      });
      const socket = fakeSocket('jwt=good');
      gateway.handleConnection(socket as unknown as Socket);
      await gateway.handleMessage('mueve a', socket as unknown as Socket);
      return socket;
    }

    it('sends the proposed actions to the client, not the internal state', async () => {
      const socket = await proposeAction();
      expect(socket.emit).toHaveBeenLastCalledWith('chatResponse', {
        response: 'Necesito tu confirmación',
        confirmation,
      });
    });

    it('resumes the agent with the user decision', async () => {
      const socket = await proposeAction();
      resolveConfirmation.mockResolvedValue({ response: 'Movido' });

      await gateway.handleConfirmation(
        { id: 'c-1', approved: true },
        socket as unknown as Socket,
      );

      expect(resolveConfirmation).toHaveBeenCalledWith(pending, true, alice);
      expect(socket.emit).toHaveBeenLastCalledWith('chatResponse', {
        response: 'Movido',
      });
    });

    it('only accepts a decision once, for the current proposal', async () => {
      const socket = await proposeAction();
      resolveConfirmation.mockResolvedValue({ response: 'ok' });

      await gateway.handleConfirmation(
        { id: 'other', approved: true },
        socket as unknown as Socket,
      );
      expect(resolveConfirmation).not.toHaveBeenCalled();

      await gateway.handleConfirmation(
        { id: 'c-1', approved: true },
        socket as unknown as Socket,
      );
      await gateway.handleConfirmation(
        { id: 'c-1', approved: true },
        socket as unknown as Socket,
      );
      expect(resolveConfirmation).toHaveBeenCalledTimes(1);
    });

    it('treats anything but approved === true as a decline', async () => {
      const socket = await proposeAction();
      resolveConfirmation.mockResolvedValue({ response: 'Cancelado' });
      await gateway.handleConfirmation(
        { id: 'c-1', approved: 'yes' },
        socket as unknown as Socket,
      );
      expect(resolveConfirmation).toHaveBeenCalledWith(pending, false, alice);
    });

    it('drops the pending action when the user sends a new message', async () => {
      const socket = await proposeAction();
      processMessage.mockResolvedValue({ response: 'otra cosa' });
      await gateway.handleMessage('olvídalo', socket as unknown as Socket);
      await gateway.handleConfirmation(
        { id: 'c-1', approved: true },
        socket as unknown as Socket,
      );
      expect(resolveConfirmation).not.toHaveBeenCalled();
    });

    it('expires unanswered proposals', async () => {
      const socket = await proposeAction();
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
      await gateway.handleConfirmation(
        { id: 'c-1', approved: true },
        socket as unknown as Socket,
      );
      jest.restoreAllMocks();
      expect(resolveConfirmation).not.toHaveBeenCalled();
    });
  });
});
