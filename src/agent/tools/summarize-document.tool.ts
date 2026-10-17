import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { DocumentReaderService } from '../documents/document-reader.service';
import { LlmService } from '../llm/llm.service';
import { toStoragePath, type AgentTool, type ToolContext } from './agent-tool';

@Injectable()
export class SummarizeDocumentTool implements AgentTool<{ filePath: string }> {
  readonly name = 'summarize_document';
  readonly description =
    'Resume el contenido de un documento (.txt, .docx, .pdf) por su ruta relativa.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string' as const,
        description:
          'Ruta relativa del documento (ej: ALICE/docs/informe.pdf).',
      },
    },
    required: ['filePath'],
  };
  readonly mutates = false;

  constructor(
    private readonly storage: StorageService,
    private readonly documentReader: DocumentReaderService,
    private readonly llm: LlmService,
  ) {}

  async run({ filePath }: { filePath: string }, { user }: ToolContext) {
    const target = await this.storage.resolveReadableFile(
      user,
      toStoragePath(filePath),
    );
    const content = await this.documentReader.readFileContent(target.absolute);
    return this.llm.summarizeText(content);
  }
}
