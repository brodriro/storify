import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatCompletionMessageToolCall, ChatCompletionMessageFunctionToolCall, ChatCompletionTool } from 'openai/resources/chat/completions';
import * as dotenv from 'dotenv';
import { AgentResponseDto } from '../agent/dto/agent-response.dto';
import { AutoParseableTool } from 'openai/lib/parser';
import { Tool } from 'openai/resources/responses/responses';
dotenv.config();

interface ToolNas {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: { [key: string]: { type: string; description: string; required?: boolean; default?: any } };
    required: string[];
  };
}

@Injectable()
export class LlmService {
  private openai: OpenAI;
  private readonly logger = new Logger(LlmService.name);

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new InternalServerErrorException('OPENAI_API_KEY is not set in environment variables');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getAgentAction(
    userMessage: string,
    availableTools: ToolNas[],
  ): Promise<AgentResponseDto> {
    this.logger.log(`Getting agent action for message: ${userMessage}`);

    const toolsForLlm: Array<Tool> = availableTools.map(tool => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: false
    }));

    try {
      const response = await this.openai.responses.create({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'system',
            content:
              'You are a helpful and friendly NAS assistant. You can perform various tasks related to NAS management by using the available tools. Decide whether to call a tool or provide a final answer to the user. If a tool call is needed, provide the tool name and parameters. If a final answer is sufficient, provide the message.',
          },
          { role: 'user', content: userMessage },
        ],
        tools: toolsForLlm,
      });

      const output = response.output;

      const toolCall = output.find(
        item => item.type === "function_call"
      );

      if (toolCall) {
        return {
          type: "action",
          action: toolCall.name,
          params: JSON.parse(toolCall.arguments),
          message: null
        };

      } else {
        const message = response.output_text?? null // textOutput?.content[0]["text"]?? null
        Logger.log(`Message ==> ${message}`, "LlmService")
        return {
          type: "final",
          action: null,
          params: null,
          message: message
        };

      }
    } catch (error) {
      this.logger.error(`Error getting agent action from LLM: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error communicating with LLM for agent action.');
    }
  }

  async generateResponse(prompt: string, context: string = ''): Promise<string> {
    this.logger.log(`Generating final response for prompt: ${prompt}`);
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful and friendly NAS assistant. Provide a concise and helpful response based on the user\'s request and the provided context. Format your response in Markdown.' },
          { role: 'user', content: context ? `${prompt}\n\nContext: ${context}` : prompt }
        ],
        model: 'gpt-5-mini',
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('LLM response content is null or undefined for generateResponse');
        throw new InternalServerErrorException('LLM response content is null or undefined');
      }
      this.logger.log(`Generated response: ${content}`);
      return content.trim();
    } catch (error) {
      this.logger.error(`Error generating response from LLM: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error generating response from LLM.');
    }
  }

  async summarizeText(text: string): Promise<string> {
    this.logger.log('Summarizing text');
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes documents. Summarize the following text in no more than 200 words.' },
          { role: 'user', content: text }
        ],
        model: 'gpt-5-mini',
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('LLM response content is null or undefined for summarizeText');
        throw new InternalServerErrorException('LLM response content is null or undefined');
      }
      this.logger.log(`Generated summary: ${content}`);
      return content.trim();
    } catch (error) {
      this.logger.error(`Error summarizing text with LLM: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error summarizing text with LLM.');
    }
  }
}
