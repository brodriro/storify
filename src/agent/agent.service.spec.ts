import type { ChatCompletionMessage } from 'openai/resources/chat/completions';
import type { AuthUser } from '../auth/auth-user';
import { AgentService } from './agent.service';
import type { LlmService } from './llm/llm.service';
import type { AgentTool } from './tools/agent-tool';
import { ToolRegistry } from './tools/tool-registry';

const ALICE: AuthUser = { username: 'ALICE', role: 'member' };
const ADMIN: AuthUser = { username: 'ADMIN', role: 'admin' };

let callSeq = 0;
function toolCall(name: string, args: Record<string, unknown>) {
  return {
    id: `call_${++callSeq}`,
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  };
}
const assistant = (
  content: string | null,
  tool_calls?: ReturnType<typeof toolCall>[],
) =>
  ({
    role: 'assistant',
    content,
    refusal: null,
    tool_calls,
  }) as ChatCompletionMessage;

function fakeTool(overrides: Partial<AgentTool> & { name: string }): AgentTool {
  return {
    description: overrides.name,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'p' } },
      required: [],
    },
    mutates: false,
    run: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function setup(tools: AgentTool[], replies: ChatCompletionMessage[]) {
  const chat = jest.fn();
  replies.forEach((r) => chat.mockResolvedValueOnce(r));
  const llm = {
    chat,
    isEnabled: () => true,
    providerLabel: () => 'OpenAI',
  } as unknown as LlmService;
  return { agent: new AgentService(llm, new ToolRegistry(tools)), chat };
}

/** Messages the model saw on its n-th call. */
const seen = (chat: jest.Mock, n: number) =>
  (chat.mock.calls[n] as unknown[])[0] as { role: string; content: unknown }[];

describe('AgentService', () => {
  it('runs the read-only tools of one turn concurrently, in call order', async () => {
    // Each tool resolves only once both have started: in series this hangs.
    let started = 0;
    let releaseAll: () => void = () => {};
    const bothStarted = new Promise<void>((resolve) => (releaseAll = resolve));
    const slowTool = (name: string, result: string, delayMs: number) =>
      fakeTool({
        name,
        run: jest.fn(async () => {
          if (++started === 2) releaseAll();
          await bothStarted;
          await new Promise((r) => setTimeout(r, delayMs));
          return result;
        }),
      });
    // The first call finishes last: results must still follow call order.
    const first = slowTool('first', 'A', 30);
    const second = slowTool('second', 'B', 0);
    const { agent, chat } = setup(
      [first, second],
      [
        assistant(null, [toolCall('first', {}), toolCall('second', {})]),
        assistant('listo'),
      ],
    );

    const turn = await Promise.race([
      agent.processMessage('dos cosas', [], ALICE),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('tools ran in series')), 1000),
      ),
    ]);

    expect(turn.response).toBe('listo');
    const toolMessages = seen(chat, 1).filter((m) => m.role === 'tool');
    expect(toolMessages.map((m) => m.content)).toEqual(['A', 'B']);
  });

  it('keeps every tool result in context across iterations (A4)', async () => {
    const list = fakeTool({
      name: 'list',
      run: jest.fn().mockResolvedValue(['ALICE/a.txt']),
    });
    const size = fakeTool({
      name: 'size',
      run: jest.fn().mockResolvedValue({ bytes: 42 }),
    });
    const { agent, chat } = setup(
      [list, size],
      [
        assistant(null, [toolCall('list', {})]),
        assistant(null, [toolCall('size', {})]),
        assistant('Hay 1 archivo de 42 bytes'),
      ],
    );

    const turn = await agent.processMessage('¿qué tengo?', [], ALICE);

    expect(turn.response).toBe('Hay 1 archivo de 42 bytes');
    const third = seen(chat, 2).filter((m) => m.role === 'tool');
    expect(third.map((m) => m.content)).toEqual([
      JSON.stringify(['ALICE/a.txt']),
      JSON.stringify({ bytes: 42 }),
    ]);
    // The user message appears exactly once.
    expect(
      seen(chat, 0).filter((m) => m.content === '¿qué tengo?'),
    ).toHaveLength(1);
  });

  it('runs tools as the session user with validated params', async () => {
    const tool = fakeTool({ name: 'read' });
    const { agent } = setup(
      [tool],
      [
        assistant(null, [
          toolCall('read', { path: 'ALICE/x', extra: 'dropped' }),
        ]),
        assistant('ok'),
      ],
    );
    await agent.processMessage('lee', [], ALICE);
    expect(tool.run).toHaveBeenCalledWith({ path: 'ALICE/x' }, { user: ALICE });
  });

  it('reports invalid arguments to the model instead of running the tool', async () => {
    const tool = fakeTool({
      name: 'read',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'p' } },
        required: ['path'],
      },
    });
    const { agent, chat } = setup(
      [tool],
      [assistant(null, [toolCall('read', {})]), assistant('falta la ruta')],
    );
    await agent.processMessage('lee', [], ALICE);
    expect(tool.run).not.toHaveBeenCalled();
    expect(seen(chat, 1).at(-1)?.content).toBe(
      'Error: Missing parameter: path',
    );
  });

  describe('admin-only tools', () => {
    const backup = fakeTool({ name: 'backup', adminOnly: true });

    it('are hidden from non-admins and refused if called anyway', async () => {
      const { agent, chat } = setup(
        [backup],
        [assistant(null, [toolCall('backup', {})]), assistant('no puedo')],
      );
      await agent.processMessage('backup', [], ALICE);
      const tools = (chat.mock.calls[0] as unknown[])[1] as unknown[];
      expect(tools).toEqual([]);
      expect(backup.run).not.toHaveBeenCalled();
    });

    it('are available to the admin', () => {
      const registry = new ToolRegistry([backup]);
      expect(registry.definitionsFor(ADMIN)).toHaveLength(1);
    });
  });

  describe('confirmation of mutating tools (D2)', () => {
    function moveSetup(after: ChatCompletionMessage) {
      const move = fakeTool({
        name: 'move',
        mutates: true,
        describe: (p: { path?: unknown }) => `Mover ${String(p.path)}`,
      });
      const read = fakeTool({ name: 'read' });
      const { agent, chat } = setup(
        [move, read],
        [
          assistant(null, [
            toolCall('read', {}),
            toolCall('move', { path: 'ALICE/a.txt' }),
          ]),
          after,
        ],
      );
      return { agent, chat, move, read };
    }

    it('pauses before running and asks the user', async () => {
      const { agent, move, read } = moveSetup(assistant('hecho'));
      const turn = await agent.processMessage('mueve', [], ALICE);

      expect(read.run).toHaveBeenCalled(); // read-only calls run right away
      expect(move.run).not.toHaveBeenCalled();
      expect(turn.confirmation?.actions).toEqual([
        { tool: 'move', summary: 'Mover ALICE/a.txt' },
      ]);
      expect(turn.pending?.confirmation.id).toBe(turn.confirmation?.id);
    });

    it('runs the action once approved and lets the model finish', async () => {
      const { agent, move } = moveSetup(assistant('Movido'));
      const turn = await agent.processMessage('mueve', [], ALICE);
      const done = await agent.resolveConfirmation(turn.pending!, true, ALICE);

      expect(move.run).toHaveBeenCalledWith(
        { path: 'ALICE/a.txt' },
        { user: ALICE },
      );
      expect(done.response).toBe('Movido');
    });

    it('tells the model when the user declines, without running it', async () => {
      const { agent, chat, move } = moveSetup(assistant('Cancelado'));
      const turn = await agent.processMessage('mueve', [], ALICE);
      await agent.resolveConfirmation(turn.pending!, false, ALICE);

      expect(move.run).not.toHaveBeenCalled();
      expect(seen(chat, 1).at(-1)?.content).toContain('declined');
    });
  });
});
