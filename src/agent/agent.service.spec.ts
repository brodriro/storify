import type { AdminService } from '../admin/admin.service';
import type { AuthUser } from '../auth/auth-user';
import type { StorageService } from '../storage/storage.service';
import { AgentService } from './agent.service';
import type { ClassificationService } from './classification/classification.service';
import type { DocumentReaderService } from './documents/document-reader.service';
import type { LlmService } from './llm/llm.service';
import type { AuditService } from '../audit/audit.service';

const ALICE: AuthUser = { username: 'ALICE', role: 'member' };
const ADMIN: AuthUser = { username: 'ADMIN', role: 'admin' };

/** Drives one tool call through processMessage and returns the observation. */
async function runTool(
  user: AuthUser,
  action: string,
  params: Record<string, unknown>,
  deps: Partial<{
    fileSystem: Partial<StorageService>;
    admin: Partial<AdminService>;
    logs: Partial<AuditService>;
    reader: Partial<DocumentReaderService>;
  }> = {},
): Promise<string> {
  const getAgentAction = jest
    .fn()
    .mockResolvedValueOnce({ type: 'action', action, params, message: null })
    .mockResolvedValueOnce({
      type: 'final',
      action: null,
      params: null,
      message: 'done',
    });
  const agent = new AgentService(
    { getAgentAction, summarizeText: jest.fn() } as unknown as LlmService,
    (deps.fileSystem ?? {}) as StorageService,
    (deps.admin ?? {}) as AdminService,
    (deps.logs ?? {}) as AuditService,
    (deps.reader ?? {}) as DocumentReaderService,
    {} as ClassificationService,
  );
  await agent.processMessage('go', [], user);
  const calls = getAgentAction.mock.calls as unknown[][];
  return calls[1][0] as string;
}

describe('AgentService tools', () => {
  it.each(['create_incremental_backup', 'get_suspicious_activity'])(
    'refuses admin tool %s for members',
    async (tool) => {
      const createBackup = jest.fn();
      const getSuspiciousActivity = jest.fn();
      const observation = await runTool(
        ALICE,
        tool,
        {},
        {
          admin: { createBackup },
          logs: { getSuspiciousActivity },
        },
      );
      expect(observation).toContain('failed');
      expect(createBackup).not.toHaveBeenCalled();
      expect(getSuspiciousActivity).not.toHaveBeenCalled();
    },
  );

  it('allows admin tools for the admin', async () => {
    const createBackup = jest.fn().mockResolvedValue(true);
    const observation = await runTool(
      ADMIN,
      'create_incremental_backup',
      {},
      {
        admin: { createBackup },
      },
    );
    expect(observation).toContain('executed successfully');
    expect(createBackup).toHaveBeenCalledWith(true);
  });

  it('acts on files as the session user, not as ADMIN (S3)', async () => {
    const moveItem = jest.fn().mockResolvedValue(undefined);
    await runTool(
      ALICE,
      'move_file',
      {
        filePath: 'public_storage/users/ALICE/a.txt',
        destination: 'ALICE/docs',
      },
      { fileSystem: { moveItem } },
    );
    expect(moveItem).toHaveBeenCalledWith(ALICE, 'ALICE/a.txt', 'ALICE/docs');
  });

  it('reads documents only through the access policy (S2)', async () => {
    const resolveReadableFile = jest
      .fn()
      .mockRejectedValue(new Error('Access denied'));
    const readFileContent = jest.fn();
    const observation = await runTool(
      ALICE,
      'summarize_document',
      { filePath: '/etc/passwd.txt' },
      { fileSystem: { resolveReadableFile }, reader: { readFileContent } },
    );
    expect(resolveReadableFile).toHaveBeenCalledWith(ALICE, 'etc/passwd.txt');
    expect(readFileContent).not.toHaveBeenCalled();
    expect(observation).toContain('Access denied');
  });
});
