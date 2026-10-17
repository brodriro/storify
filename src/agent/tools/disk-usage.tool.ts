import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import type { AgentTool } from './agent-tool';

@Injectable()
export class DiskUsageTool implements AgentTool {
  readonly name = 'get_disk_usage';
  readonly description = 'Obtiene el uso actual del disco del NAS.';
  readonly parameters = {
    type: 'object' as const,
    properties: {},
    required: [],
  };
  readonly mutates = false;

  constructor(private readonly storage: StorageService) {}

  run() {
    return this.storage.getDiskUsage();
  }
}
