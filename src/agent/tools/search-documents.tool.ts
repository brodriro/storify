import { Injectable } from '@nestjs/common';
import { TEXT_EXTENSIONS } from '../../common/file-types';
import { StorageService } from '../../storage/storage.service';
import type { AgentTool, ToolContext } from './agent-tool';

const MAX_RESULTS = 50;

@Injectable()
export class SearchDocumentsTool implements AgentTool<{ name: string }> {
  readonly name = 'list_documents_by_name';
  readonly description =
    'Busca documentos (.txt, .docx, .pdf) cuyo nombre contenga el texto indicado. Devuelve rutas relativas.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Texto a buscar en el nombre del documento.',
      },
    },
    required: ['name'],
  };
  readonly mutates = false;

  constructor(private readonly storage: StorageService) {}

  async run({ name }: { name: string }, { user }: ToolContext) {
    const files = await this.storage.searchFiles(
      user,
      name,
      TEXT_EXTENSIONS,
      MAX_RESULTS,
    );
    return files.map((f) => f.path);
  }
}
