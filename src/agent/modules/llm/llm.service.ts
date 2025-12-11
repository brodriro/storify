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

  async getIntent(message: string): Promise<any> {
    Logger.log(`Getting intent for message: ${message}`, 'LlmService');
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that understands NAS operations. Categorize the user\'s intent as disk_usage, recent_files, backup_incremental, suspicious_activity, or unknown. Respond only with the intent.' },
          { role: 'user', content: message }
        ],
        model: 'gpt-5-mini',
      });
      Logger.log(`LLM response completion: ${JSON.stringify(completion)}`, 'LlmService');
      Logger.log(`LLM response completion choices[0].message.content: ${JSON.stringify(completion.choices[0].message.content)}`, 'LlmService');
      const content = completion.choices?.[0]?.message?.content;

      if (!content) {
        Logger.error('LLM response content is null or undefined', 'LlmService');
        throw new InternalServerErrorException('LLM response content is null or undefined');
      }
      const intent = content.trim();
      Logger.log(`Intent: ${intent}`, 'LlmService');
      return { intent };
    } catch (error) {
      Logger.error(`Error getting intent from LLM: ${error}`, 'LlmService');
      console.error('Error getting intent from LLM:', error);
      throw new InternalServerErrorException('Failed to get intent from LLM');
    }
  }
}
