import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import hbs from 'hbs';
import helmet from 'helmet';
import { dirname, join } from 'path';
import { ViewExceptionFilter } from './common/view-exception.filter';

/**
 * Resolves an asset directory both when running the compiled build (nest-cli
 * copies views/ and public/ next to dist/main.js) and from source (ts-node,
 * jest), where they live at the project root.
 */
function assetDir(name: string): string {
  const besideBuild = join(__dirname, name);
  return existsSync(besideBuild) ? besideBuild : join(__dirname, '..', name);
}

function registerPartials(dir: string): Promise<void> {
  return new Promise((resolve) => hbs.registerPartials(dir, () => resolve()));
}

/**
 * Express-level setup shared by main.ts and the e2e tests: static assets,
 * Handlebars views/partials/helpers and cookie parsing.
 */
export async function configureApp(app: NestExpressApplication): Promise<void> {
  const viewsPath = assetDir('views');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          // No inline scripts anywhere: views load /js/*.js only.
          scriptSrc: ["'self'"],
          // Inline style attributes remain in the views (plan U11).
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Fonts are self-hosted (/vendor/fira-*): no Google Fonts.
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Deliberately no upgrade-insecure-requests: the NAS is often served
          // over plain HTTP on the LAN.
        },
      },
    }),
  );

  app.useStaticAssets(assetDir('public'));
  // Browser bundles served from node_modules, so versions are pinned by the
  // lockfile and the app works without Internet access (no CDNs).
  app.useStaticAssets(dirname(require.resolve('marked')), {
    prefix: '/vendor/marked/',
  });
  app.useStaticAssets(dirname(require.resolve('dompurify')), {
    prefix: '/vendor/dompurify/',
  });
  for (const font of ['fira-sans', 'fira-code']) {
    app.useStaticAssets(
      join(
        dirname(require.resolve(`@fontsource/${font}/package.json`)),
        'files',
      ),
      { prefix: `/vendor/${font}/`, maxAge: '30d', immutable: true },
    );
  }
  app.setBaseViewsDir(viewsPath);
  app.setViewEngine('hbs');

  await registerPartials(join(viewsPath, 'partials'));
  // Layouts are registered as partials (required for {{#> main}} syntax)
  await registerPartials(join(viewsPath, 'layouts'));

  hbs.registerHelper(
    'if_eq',
    function (
      this: unknown,
      arg1: unknown,
      arg2: unknown,
      options: Handlebars.HelperOptions,
    ) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    },
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new ViewExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
}
