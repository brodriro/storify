import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import hbs from 'hbs';
import { join } from 'path';

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

  app.useStaticAssets(assetDir('public'));
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
}
