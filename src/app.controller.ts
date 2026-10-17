import { Controller, Get, Query, Render } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Render('index')
  root(@Query('error') error?: string) {
    return { title: 'Login', error: error !== undefined };
  }
}
