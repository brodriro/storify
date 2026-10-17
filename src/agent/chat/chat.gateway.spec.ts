import type { Socket } from 'socket.io';
import type { AuthService } from '../../auth/auth.service';
import type { AgentService } from '../agent.service';
import type { LogsService } from '../logs/logs.service';
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
  let gateway: ChatGateway;

  beforeEach(() => {
    verifyToken.mockReset();
    processMessage.mockReset();
    gateway = new ChatGateway(
      { log: jest.fn() } as unknown as LogsService,
      { processMessage } as unknown as AgentService,
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

    const [event, payload] = socket.emit.mock.calls[0] as [
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
});
