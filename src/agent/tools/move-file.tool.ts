import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { toStoragePath, type AgentTool, type ToolContext } from './agent-tool';

type Params = { filePath: string; destination: string };

@Injectable()
export class MoveFileTool implements AgentTool<Params> {
  readonly name = 'move_file';
  readonly description =
    'Mueve un archivo o carpeta a otra carpeta. Requiere la confirmación del usuario.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string' as const,
        description: 'Ruta relativa actual (ej: ALICE/docs/factura.pdf).',
      },
      destination: {
        type: 'string' as const,
        description:
          'Ruta relativa de la carpeta destino (ej: ALICE/facturas).',
      },
    },
    required: ['filePath', 'destination'],
  };
  readonly mutates = true;

  constructor(private readonly storage: StorageService) {}

  describe({ filePath, destination }: Params) {
    return `Mover «${toStoragePath(filePath)}» a «${toStoragePath(destination) || '/'}»`;
  }

  async run({ filePath, destination }: Params, { user }: ToolContext) {
    const from = toStoragePath(filePath);
    const to = toStoragePath(destination);
    await this.storage.moveItem(user, from, to);
    return { moved: from, to };
  }
}
