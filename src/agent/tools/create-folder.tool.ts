import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { toStoragePath, type AgentTool, type ToolContext } from './agent-tool';

type Params = { path: string; name: string };

@Injectable()
export class CreateFolderTool implements AgentTool<Params> {
  readonly name = 'create_folder';
  readonly description =
    'Crea una carpeta. Requiere la confirmación del usuario.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'Ruta relativa de la carpeta padre ("" para la raíz).',
        default: '',
      },
      name: {
        type: 'string' as const,
        description: 'Nombre de la nueva carpeta.',
      },
    },
    required: ['name'],
  };
  readonly mutates = true;

  constructor(private readonly storage: StorageService) {}

  describe({ path, name }: Params) {
    return `Crear la carpeta «${name}» en «${toStoragePath(path) || '/'}»`;
  }

  async run({ path, name }: Params, { user }: ToolContext) {
    const parent = toStoragePath(path);
    await this.storage.createFolder(user, parent, name);
    return { created: parent ? `${parent}/${name}` : name };
  }
}
