import { Controller, Get, Render } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Render('index')
  root() { // @Request() req if we want to check if already logged in and redirect
    return { title: 'Login' };
  }
}
