import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { LlmService } from './llm/llm.service';
import { FileSystemService } from './../filesystem/filesystem.service';
import { AdminService } from './../admin/admin.service';
import { LogsService } from './logs/logs.service';
import { FileReaderService } from './file-reader/file-reader.service';
import { ClassificationService } from './classification/classification.service';
import { AgentResponseDto } from './dto/agent-response.dto';
import { ChatMessage, ToolNas } from './interfaces/ChatMessage';

const DOCUMENT_EXTENSIONS = ['.txt', '.docx', '.pdf'];

/**
 * The model sometimes echoes on-disk prefixes ("public_storage/users/...");
 * tools expect paths relative to the user's storage root.
 */
function toStoragePath(value: string): string {
  return value
    .trim()
    .replace(/^\.?\/?(?:public_storage\/)?users\//, '')
    .replace(/^\.?\/+/, '');
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private maxIterations = 12;

  private availableTools: ToolNas[] = [
    {
      name: 'get_disk_usage',
      description: 'Obtiene el uso actual del disco del NAS.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_recent_files',
      description: 'Obtiene una lista de archivos recientes en el NAS.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description:
              'Número de días hacia atrás para buscar archivos recientes.',
            default: 7,
          },
        },
        required: [],
      },
    },
    {
      name: 'create_incremental_backup',
      description: 'Inicia un backup incremental del NAS.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_suspicious_activity',
      description: 'Obtiene registros de actividad sospechosa en el NAS.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'list_documents_by_name',
      description: 'Lista documentos por nombre en una ruta específica.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'El nombre o parte del nombre del documento a buscar.',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'summarize_document',
      description: 'Resume el contenido de un documento específico.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'El nombre completo del documento a resumir.',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'classify_file',
      description:
        'Clasifica automáticamente un archivo del NAS. Analiza su contenido, metadata y estructura para determinar categoría, subcategoría, sensibilidad, etiquetas y acciones sugeridas.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description:
              'Ruta relativa del archivo dentro del NAS (ej: ADMIN/docs/factura.pdf).',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'move_file',
      description:
        'Mueve un archivo o carpeta a una nueva ubicación dentro del NAS.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description:
              'Ruta relativa actual del archivo (ej: ADMIN/docs/factura.pdf).',
          },
          destination: {
            type: 'string',
            description:
              'Ruta relativa de la carpeta destino (ej: ADMIN/finanzas/facturas).',
          },
        },
        required: ['filePath', 'destination'],
      },
    },
    {
      name: 'create_folder',
      description: 'Crea una nueva carpeta dentro del NAS.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'Ruta relativa del directorio padre donde se creará la carpeta (ej: ADMIN/finanzas).',
          },
          name: {
            type: 'string',
            description: 'Nombre de la nueva carpeta a crear.',
          },
        },
        required: ['path', 'name'],
      },
    },
  ];

  constructor(
    private readonly llmService: LlmService,
    private readonly fileSystemService: FileSystemService,
    private readonly adminService: AdminService,
    private readonly logsService: LogsService,
    private readonly fileReaderService: FileReaderService,
    private readonly classificationService: ClassificationService,
  ) {}

  async processMessage(
    userMessage: string,
    history: ChatMessage[],
    user: AuthUser,
  ): Promise<{ response: string }> {
    let currentMessage = userMessage;
    let agentResponse: AgentResponseDto | null = null;
    let iterations = 0;

    while (iterations < this.maxIterations) {
      this.logger.log(
        `Iteration ${iterations + 1}: Processing message: ${currentMessage}`,
      );

      // LLM Reasoner: Decide whether to take an action or provide a final answer
      agentResponse = await this.llmService.getAgentAction(
        currentMessage,
        this.availableTools,
        history,
      );

      if (agentResponse === null || agentResponse === undefined) {
        this.logger.warn(
          'LLM Reasoner returned null or undefined agentResponse. Continuing to next iteration or handling as error.',
        );
        // Optionally, you might want to return an error or break the loop here.
        // For now, I'll just skip the current iteration and log a warning.
        iterations++; // Increment iterations to prevent infinite loop if LLM always returns null
        continue; // Skip to the next iteration
      }

      if (agentResponse.type === 'final') {
        this.logger.log('LLM Reasoner decided on final response.');
        return { response: agentResponse.message || 'No response provided.' };
      }

      if (agentResponse.type === 'action' && agentResponse.action) {
        this.logger.log(
          `LLM Reasoner decided to take action: ${agentResponse.action} with params: ${JSON.stringify(agentResponse.params)}`,
        );
        // Tool Executor: Execute the action
        try {
          const toolResult = await this.executeTool(
            agentResponse.action,
            agentResponse.params,
            user,
          );
          // Observation Handler: Normalize and feed back to LLM Reasoner
          currentMessage = `Tool ${agentResponse.action} executed successfully. Observation: ${JSON.stringify(toolResult)}`;
          this.logger.log(
            `Tool execution successful. Observation: ${currentMessage}`,
          );
        } catch (error) {
          currentMessage = `Tool ${agentResponse.action} failed. Error: ${error.message}`;
          this.logger.error(
            `Tool execution failed. Error: ${error.message}`,
            error.stack,
          );
        }
      } else {
        this.logger.warn(
          'LLM Reasoner did not provide a valid action or final response type.',
        );
        return {
          response:
            'I could not determine a valid action or response based on your request.',
        };
      }
      iterations++;
    }

    this.logger.warn('Max iterations reached. Providing a default response.');
    return {
      response:
        agentResponse?.message ||
        'I could not complete your request within the allowed iterations.',
    };
  }

  /**
   * Runs a tool on behalf of `user`. Every file access goes through the same
   * access policy as the HTTP API; administrative tools require the admin role.
   */
  private async executeTool(
    action: string,
    params: { [key: string]: any } | null,
    user: AuthUser,
  ): Promise<unknown> {
    const requireAdmin = () => {
      if (user.role !== 'admin') {
        throw new ForbiddenException(
          `Tool ${action} is only available to administrators`,
        );
      }
    };
    const requireString = (name: string): string => {
      const value: unknown = params?.[name];
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing parameter: ${name} for ${action}`);
      }
      return toStoragePath(value);
    };

    switch (action) {
      case 'get_disk_usage':
        return this.fileSystemService.getDiskUsage();
      case 'get_recent_files': {
        const days = Number(params?.days);
        return this.fileSystemService.getRecentFiles(
          user,
          Number.isFinite(days) && days > 0 ? days : 7,
        );
      }
      case 'create_incremental_backup':
        requireAdmin();
        return this.adminService.createBackup(true);
      case 'get_suspicious_activity':
        requireAdmin();
        return this.logsService.getSuspiciousActivity();
      case 'list_documents_by_name': {
        const name = requireString('name');
        const files = await this.fileSystemService.searchFiles(
          user,
          name,
          DOCUMENT_EXTENSIONS,
        );
        return files.map((f) => f.path);
      }
      case 'summarize_document': {
        const target = await this.fileSystemService.resolveReadableFile(
          user,
          requireString('filePath'),
        );
        const content = await this.fileReaderService.readFileContent(
          target.absolute,
        );
        return this.llmService.summarizeText(content);
      }
      case 'classify_file':
        return this.classificationService.classifyFile(
          user,
          requireString('filePath'),
        );
      case 'move_file': {
        const filePath = requireString('filePath');
        const destination = requireString('destination');
        await this.fileSystemService.moveItem(user, filePath, destination);
        return {
          success: true,
          message: `Archivo movido de ${filePath} a ${destination}`,
        };
      }
      case 'create_folder': {
        const parent = toStoragePath(
          typeof params?.path === 'string' ? params.path : '',
        );
        const name = requireString('name');
        await this.fileSystemService.createFolder(user, parent, name);
        return {
          success: true,
          message: `Carpeta '${name}' creada en ${parent || '/'}`,
        };
      }
      default:
        throw new Error(`Unknown tool: ${action}`);
    }
  }
}
