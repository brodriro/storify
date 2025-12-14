import { Controller, Post, Body } from '@nestjs/common';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('intent')
  async getIntent(@Body('message') message: string) {
    return this.llmService.getIntent(message);
  }
}
