import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AppConfig } from '../../config/configuration';
import { AgentResponseDto } from '../dto/agent-response.dto';
import { Tool } from 'openai/resources/responses/responses';
import { ChatMessage, ToolNas } from '../interfaces/ChatMessage';
import { FileClassificationResponse } from '../interfaces/classification.interface';

@Injectable()
export class LlmService {
  private readonly client: OpenAI | null;
  private readonly logger = new Logger(LlmService.name);

  constructor(configService: ConfigService<AppConfig, true>) {
    const apiKey = configService.get('openaiApiKey', { infer: true });
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY is not set: AI features are disabled');
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /** The OpenAI client, or a 503 when AI features are disabled. */
  private get openai(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features are disabled (OPENAI_API_KEY is not configured)',
      );
    }
    return this.client;
  }

  async getAgentAction(
    userMessage: string,
    availableTools: ToolNas[],
    chatHistory: ChatMessage[] = [],
  ): Promise<AgentResponseDto> {
    this.logger.log(`Getting agent action for message: ${userMessage}`);

    const toolsForLlm: Array<Tool> = availableTools.map((tool) => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: false,
    }));

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a helpful and friendly NAS assistant. You can perform various tasks related to NAS management by using the available tools. Decide whether to call a tool or provide a final answer to the user. If a tool call is needed, provide the tool name and parameters. If a final answer is sufficient, provide the message.',
      },
      ...chatHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    try {
      const response = await this.openai.responses.create({
        model: 'gpt-5-mini',
        input: messages,
        tools: toolsForLlm,
      });

      const output = response.output;

      const toolCall = output.find((item) => item.type === 'function_call');

      if (toolCall) {
        return {
          type: 'action',
          action: toolCall.name,
          params: JSON.parse(toolCall.arguments),
          message: null,
        };
      } else {
        const message = response.output_text ?? null; // textOutput?.content[0]["text"]?? null
        Logger.log(`Message ==> ${message}`, 'LlmService');
        return {
          type: 'final',
          action: null,
          params: null,
          message: message,
        };
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error getting agent action from LLM: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error communicating with LLM for agent action.',
      );
    }
  }

  async generateResponse(
    prompt: string,
    context: string = '',
  ): Promise<string> {
    this.logger.log(`Generating final response for prompt: ${prompt}`);
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              "You are a helpful and friendly NAS assistant. Provide a concise and helpful response based on the user's request and the provided context. Format your response in Markdown.",
          },
          {
            role: 'user',
            content: context ? `${prompt}\n\nContext: ${context}` : prompt,
          },
        ],
        model: 'gpt-5-mini',
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error(
          'LLM response content is null or undefined for generateResponse',
        );
        throw new InternalServerErrorException(
          'LLM response content is null or undefined',
        );
      }
      this.logger.log(`Generated response: ${content}`);
      return content.trim();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error generating response from LLM: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error generating response from LLM.',
      );
    }
  }

  async summarizeText(text: string): Promise<string> {
    this.logger.log('Summarizing text');
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that summarizes documents. Summarize the following text in no more than 200 words.',
          },
          { role: 'user', content: text },
        ],
        model: 'gpt-5-mini',
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error(
          'LLM response content is null or undefined for summarizeText',
        );
        throw new InternalServerErrorException(
          'LLM response content is null or undefined',
        );
      }
      this.logger.log(`Generated summary: ${content}`);
      return content.trim();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error summarizing text with LLM: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error summarizing text with LLM.',
      );
    }
  }

  async classifyFile(prompt: string): Promise<FileClassificationResponse> {
    this.logger.log('Classifying file via LLM');
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'Eres un agente experto en clasificación automática de archivos dentro de un sistema NAS. Responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional.',
          },
          { role: 'user', content: prompt },
        ],
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error(
          'LLM response content is null or undefined for classifyFile',
        );
        throw new InternalServerErrorException(
          'LLM response content is null or undefined',
        );
      }

      this.logger.log(`Classification result received`);
      return JSON.parse(content) as FileClassificationResponse;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error classifying file with LLM: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error classifying file with LLM.',
      );
    }
  }
}
