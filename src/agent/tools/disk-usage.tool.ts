import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import type { AgentTool } from './agent-tool';

@Injectable()
export class DiskUsageTool implements AgentTool {
  readonly name = 'get_disk_usage';
  readonly description =
    'Obtiene lo que ocupan los archivos del NAS (totalBytes) y el tamaño y el espacio libre del disco (volume), en bytes.';
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
