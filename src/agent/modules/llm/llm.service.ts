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

  async generateResponse(message: string, intent: any, actionResult: any = {}): Promise<string> {
    Logger.log(`Generating human-like response for message: "${message}" with intent: "${JSON.stringify(intent)}" and action result: ${JSON.stringify(actionResult)}`, 'LlmService');
    let systemContent = `You are a helpful and friendly NAS assistant. The user's original message was "${message}". Their intent has been identified as "${JSON.stringify(intent)}".`;

    if (Object.keys(actionResult).length > 0) {
      systemContent += ` The result of the executed action is: ${JSON.stringify(actionResult)}. Please provide a polite and informative response to the user based on their original message, their intent: "${JSON.stringify(intent)}", and the action result: ${JSON.stringify(actionResult)}. Format your response in Markdown.`;
    } else {
      systemContent += ` Please provide a polite and informative response to the user based on their original message and their intent: "${JSON.stringify(intent)}". Format your response in Markdown.`;
    }


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
}
