import { t } from './i18n';
import { Controller, Get, Query, Render } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Render('index')
  root(@Query('error') error?: string) {
    return { pageTitle: t('login.title'), error: error !== undefined };
  }
}
