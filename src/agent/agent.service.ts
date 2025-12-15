import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm/llm.service';
import { FileSystemService } from './../filesystem/filesystem.service';
import { AdminService } from './../admin/admin.service';
import { LogsService } from './logs/logs.service';
import { FileReaderService } from './file-reader/file-reader.service';
import { AgentResponseDto } from './dto/agent-response.dto';
import { ChatMessage, ToolNas } from 'src/agent/interfaces/ChatMessage';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private maxIterations = 3;

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
          days: { type: 'number', description: 'Número de días hacia atrás para buscar archivos recientes.', default: 7 },
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
          name: { type: 'string', description: 'El nombre o parte del nombre del documento a buscar.' },
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
          filePath: { type: 'string', description: 'El nombre completo del documento a resumir.'},
        },
        required: ['filePath'],
      },
    },
  ];

  constructor(
    private readonly llmService: LlmService,
    private readonly fileSystemService: FileSystemService,
    private readonly adminService: AdminService,
    private readonly logsService: LogsService,
    private readonly fileReaderService: FileReaderService,
  ) { }

  async processMessage(userMessage: string, history: ChatMessage[]): Promise<{ response: string }> {
    let currentMessage = userMessage;
    let agentResponse: AgentResponseDto | null = null;
    let iterations = 0;

    while (iterations < this.maxIterations) {
      this.logger.log(`Iteration ${iterations + 1}: Processing message: ${currentMessage}`);

      // LLM Reasoner: Decide whether to take an action or provide a final answer
      agentResponse = await this.llmService.getAgentAction(
        currentMessage,
        this.availableTools,
        history
      );

      if (agentResponse === null || agentResponse === undefined) {
        this.logger.warn('LLM Reasoner returned null or undefined agentResponse. Continuing to next iteration or handling as error.');
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
        this.logger.log(`LLM Reasoner decided to take action: ${agentResponse.action} with params: ${JSON.stringify(agentResponse.params)}`);
        // Tool Executor: Execute the action
        try {
          const toolResult = await this.executeTool(agentResponse.action, agentResponse.params);
          // Observation Handler: Normalize and feed back to LLM Reasoner
          currentMessage = `Tool ${agentResponse.action} executed successfully. Observation: ${JSON.stringify(toolResult)}`;
          this.logger.log(`Tool execution successful. Observation: ${currentMessage}`);
        } catch (error) {
          currentMessage = `Tool ${agentResponse.action} failed. Error: ${error.message}`;
          this.logger.error(`Tool execution failed. Error: ${error.message}`, error.stack);
        }
      } else {
        this.logger.warn('LLM Reasoner did not provide a valid action or final response type.');
        return { response: 'I could not determine a valid action or response based on your request.' };
      }
      iterations++;
    }

    this.logger.warn('Max iterations reached. Providing a default response.');
    return { response: agentResponse?.message || 'I could not complete your request within the allowed iterations.' };
  }

  private async executeTool(action: string, params: { [key: string]: any } | null): Promise<any> {
    switch (action) {
      case 'get_disk_usage':
        return this.fileSystemService.getDiskUsage();
      case 'get_recent_files':
        return this.fileSystemService.getRecentFiles(params?.days);
      case 'create_incremental_backup':
        return this.adminService.createBackup(true);
      case 'get_suspicious_activity':
        return this.logsService.getSuspiciousActivity();
      case 'list_documents_by_name':
        if (!params || !params.name) {
          throw new Error('Missing parameter: name for list_documents_by_name');
        }
        return this.fileReaderService.listDocumentsByName(params.name);
      case 'summarize_document':
        if (!params || !params.filePath) {
          throw new Error('Missing parameter: filePath for summarize_document');
        }
        const fileContent = await this.fileReaderService.readFileContent(params.filePath);
        return this.llmService.summarizeText(fileContent);
      default:
        throw new Error(`Unknown tool: ${action}`);
    }
  }
}
