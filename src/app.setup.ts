import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import hbs from 'hbs';
import helmet from 'helmet';
import { dirname, join } from 'path';
import { clientMessagesJson, format, lookup } from './i18n';
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
          // No inline styles either (U11): views use classes only. Scripts may
          // still set element.style through the CSSOM, which CSP allows.
          styleSrc: ["'self'"],
          // Fonts are self-hosted (/vendor/archivo/): no Google Fonts.
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
  app.useStaticAssets(
    join(
      dirname(require.resolve('@fontsource-variable/archivo/package.json')),
      'files',
    ),
    { prefix: '/vendor/archivo/', maxAge: '30d', immutable: true },
  );
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

  // {{t "browser.title"}} or {{t "browser.usedOf" used=a total=b}} (escaped).
  hbs.registerHelper(
    't',
    function (key: string, options: Handlebars.HelperOptions) {
      const template = lookup(key);
      if (template === undefined)
        throw new Error(`Unknown message key: ${key}`);
      return format(template, options.hash as Record<string, unknown>);
    },
  );
  hbs.registerHelper(
    'clientMessages',
    () => new hbs.handlebars.SafeString(clientMessagesJson()),
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
