import { Injectable } from '@nestjs/common';
import { ClassificationService } from '../classification/classification.service';
import { toStoragePath, type AgentTool, type ToolContext } from './agent-tool';

@Injectable()
export class ClassifyFileTool implements AgentTool<{ filePath: string }> {
  readonly name = 'classify_file';
  readonly description =
    'Clasifica un archivo: categoría, subcategoría, sensibilidad, etiquetas y acciones sugeridas. Solo sugiere; no mueve nada.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string' as const,
        description: 'Ruta relativa del archivo (ej: ALICE/docs/factura.pdf).',
      },
    },
    required: ['filePath'],
  };
  readonly mutates = false;

  constructor(private readonly classification: ClassificationService) {}

  run({ filePath }: { filePath: string }, { user }: ToolContext) {
    return this.classification.classifyFile(user, toStoragePath(filePath));
  }
}
