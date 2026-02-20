import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

import cookieParser from 'cookie-parser';
const hbs = require('hbs');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Use distribution paths if assets are copied
  const isDist = __dirname.includes('dist');
  const staticPath = isDist ? join(__dirname, 'public') : join(__dirname, '..', 'public');
  const viewsPath = isDist ? join(__dirname, 'views') : join(__dirname, '..', 'views');

  app.useStaticAssets(staticPath);
  app.setBaseViewsDir(viewsPath);
  app.setViewEngine('hbs');

  // Register Partials
  hbs.registerPartials(join(viewsPath, 'partials'));
  // Register Layouts as partials (required for {{#> layout}} syntax)
  hbs.registerPartials(join(viewsPath, 'layouts'));

  hbs.registerHelper('if_eq', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
  });

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
