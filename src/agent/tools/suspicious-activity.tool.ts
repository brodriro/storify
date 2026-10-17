import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { AgentTool } from './agent-tool';

@Injectable()
export class SuspiciousActivityTool implements AgentTool {
  readonly name = 'get_suspicious_activity';
  readonly description =
    'Informe de actividad sospechosa: ráfagas de logins fallidos y accesos denegados por usuario (solo administradores).';
  readonly parameters = {
    type: 'object' as const,
    properties: {},
    required: [],
  };
  readonly mutates = false;
  readonly adminOnly = true;

  constructor(private readonly audit: AuditService) {}

  run() {
    return this.audit.getSuspiciousActivity();
  }
}
