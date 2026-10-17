import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import type { AgentTool, ToolContext } from './agent-tool';

/** Caps the list sent to the model (token cost / context window). */
const MAX_RESULTS = 50;

@Injectable()
export class RecentFilesTool implements AgentTool<{ days: number }> {
  readonly name = 'get_recent_files';
  readonly description =
    'Lista los archivos modificados recientemente que el usuario puede ver (los más recientes primero, máximo 50).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      days: {
        type: 'integer' as const,
        description: 'Número de días hacia atrás.',
        default: 7,
      },
    },
    required: [],
  };
  readonly mutates = false;

  constructor(private readonly storage: StorageService) {}

  async run({ days }: { days: number }, { user }: ToolContext) {
    return this.storage.getRecentFiles(user, days > 0 ? days : 7, MAX_RESULTS);
  }
}
