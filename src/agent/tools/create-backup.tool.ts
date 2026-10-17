import { Injectable } from '@nestjs/common';
import { BackupService } from '../../backup/backup.service';
import type { AgentTool } from './agent-tool';

@Injectable()
export class CreateBackupTool implements AgentTool {
  readonly name = 'create_incremental_backup';
  readonly description =
    'Inicia un backup incremental del NAS en segundo plano (solo administradores).';
  readonly parameters = {
    type: 'object' as const,
    properties: {},
    required: [],
  };
  readonly mutates = true;
  readonly adminOnly = true;

  constructor(private readonly backups: BackupService) {}

  describe() {
    return 'Iniciar un backup incremental';
  }

  async run() {
    const started = await this.backups.start('incremental');
    return started
      ? { started: true }
      : { started: false, reason: 'Ya hay un backup en curso' };
  }
}
