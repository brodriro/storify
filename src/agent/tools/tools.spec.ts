import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import type { StorageService } from '../../storage/storage.service';
import type { DocumentReaderService } from '../documents/document-reader.service';
import type { LlmService } from '../llm/llm.service';
import { validateToolParams } from './agent-tool';
import { MoveFileTool } from './move-file.tool';
import { SummarizeDocumentTool } from './summarize-document.tool';

const ALICE: AuthUser = { username: 'ALICE', role: 'member' };

describe('agent tools', () => {
  it('move_file acts as the session user and strips on-disk prefixes (S3)', async () => {
    const moveItem = jest.fn().mockResolvedValue(undefined);
    const tool = new MoveFileTool({ moveItem } as unknown as StorageService);
    await tool.run(
      {
        filePath: 'public_storage/users/ALICE/a.txt',
        destination: 'ALICE/docs',
      },
      { user: ALICE },
    );
    expect(moveItem).toHaveBeenCalledWith(ALICE, 'ALICE/a.txt', 'ALICE/docs');
  });

  it('summarize_document only reads files the access policy allows (S2)', async () => {
    const resolveReadableFile = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('Access denied'));
    const readFileContent = jest.fn();
    const tool = new SummarizeDocumentTool(
      { resolveReadableFile } as unknown as StorageService,
      { readFileContent } as unknown as DocumentReaderService,
      {} as LlmService,
    );
    await expect(
      tool.run({ filePath: '/etc/passwd.txt' }, { user: ALICE }),
    ).rejects.toThrow('Access denied');
    expect(resolveReadableFile).toHaveBeenCalledWith(ALICE, 'etc/passwd.txt');
    expect(readFileContent).not.toHaveBeenCalled();
  });

  describe('validateToolParams', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        path: { type: 'string' as const, description: '' },
        days: { type: 'integer' as const, description: '', default: 7 },
      },
      required: ['path'],
    };

    it('applies defaults, coerces numeric strings and drops unknown keys', () => {
      expect(validateToolParams(schema, { path: 'a', x: 1 })).toEqual({
        path: 'a',
        days: 7,
      });
      expect(validateToolParams(schema, { path: 'a', days: '3' })).toEqual({
        path: 'a',
        days: 3,
      });
    });

    it.each([
      [{}, 'Missing parameter: path'],
      [{ path: 1 }, 'path must be a string'],
      [{ path: 'a', days: 1.5 }, 'days must be a integer'],
      [{ path: 'a', days: 'many' }, 'days must be a integer'],
    ])('rejects %j', (input, message) => {
      expect(() => validateToolParams(schema, input)).toThrow(message);
    });
  });
});
