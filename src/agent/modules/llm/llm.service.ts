import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class LlmService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new InternalServerErrorException('OPENAI_API_KEY is not set in environment variables');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getIntent(message: string): Promise<{ intent: string, parameters?: any }> {
    Logger.log(`Getting intent and parameters for message: ${message}`, 'LlmService');
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that understands NAS operations. Categorize the user\'s intent as disk_usage, recent_files, backup_incremental, suspicious_activity, list_documents_by_name, summarize_document, or unknown. Respond only with the intent.' },
          { role: 'user', content: message }
        ],
        model: 'gpt-5-mini',
      });
      Logger.log(`LLM response completion: ${JSON.stringify(completion)}`, 'LlmService');
      const content = completion.choices?.[0]?.message?.content;

      if (!content) {
        Logger.error('LLM response content is null or undefined', 'LlmService');
        // Fallback to unknown intent if content is null or undefined
        return { intent: 'unknown' };
      }
      const intent = content.trim();
      Logger.log(`Intent: ${intent}`, 'LlmService');

      if (intent === '') {
        Logger.log('Intent is empty, defaulting to unknown', 'LlmService');
        return { intent: 'unknown' };
      }

      return { intent };
    } catch (error) {
      Logger.error(`Error getting intent and parameters from LLM: ${error}`, 'LlmService');
      console.error('Error getting intent and parameters from LLM:', error);
      return { intent: 'unknown' }; // Fallback to unknown intent
    }
  }

  async generateResponse(message: string, intent: string, actionResult: any = {}): Promise<string> {
    Logger.log(`Generating human-like response for message: "${message}" with intent: "${JSON.stringify(intent)}" and action result: ${JSON.stringify(actionResult)}`, 'LlmService');
    let systemContent: string;

    if (intent === 'unknown') {
      systemContent = 'You are a helpful and friendly NAS assistant. The user\'s intent was unknown. Please provide a polite response indicating that you did not understand and list the available commands: disk usage, recent files, backup, suspicious activity, list documents by name, summarize document. Format your response in Markdown.';
    } else {
      systemContent = `You are a helpful and friendly NAS assistant. The user's original message was "${message}". Their intent has been identified as "${intent}".`;

      if (Object.keys(actionResult).length > 0) {
        systemContent += ` The result of the executed action is: ${JSON.stringify(actionResult)}. Please provide a polite and informative response to the user based on their original message, their intent, and the action result. Format your response in Markdown.`;
      } else {
        systemContent += ` Please provide a polite and informative response to the user based on their original message and their intent. Format your response in Markdown.`;
      }
    }

    Logger.log(`Prompt: ${systemContent}`, 'LlmService')
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: message }
        ],
        model: 'gpt-5-mini', // Using the same model as for intent detection
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        Logger.error('LLM response content is null or undefined for generateResponse', 'LlmService');
        throw new InternalServerErrorException('LLM response content is null or undefined');
      }
      Logger.log(`Generated response: ${content}`, 'LlmService');
      return content.trim();
    } catch (error) {
      Logger.error(`Error generating response from LLM: ${error}`, 'LlmService');
      console.error('Error generating response from LLM:', error);
      return "I'm sorry, I couldn't generate a detailed response at this time.";
    }
  }

  async summarizeText(text: string): Promise<string> {
    Logger.log('Summarizing text', 'LlmService');
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
        Logger.error('LLM response content is null or undefined for summarizeText', 'LlmService');
        throw new InternalServerErrorException('LLM response content is null or undefined');
      }
      Logger.log(`Generated summary: ${content}`, 'LlmService');
      return content.trim();
    } catch (error) {
      Logger.error(`Error summarizing text with LLM: ${error}`, 'LlmService');
      console.error('Error summarizing text with LLM:', error);
      return "I'm sorry, I couldn't summarize the document at this time.";
    }
  }



}
