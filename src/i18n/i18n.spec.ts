import * as fs from 'fs';
import * as path from 'path';
import { format, lookup, messages, t } from '.';

const root = path.join(__dirname, '..', '..');

function filesIn(dir: string, ext: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(dir, entry.name), ext)
        : entry.name.endsWith(ext)
          ? [path.join(dir, entry.name)]
          : [],
    );
}

describe('UI strings (D5)', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(t('browser.usedOf', { used: '1 GB', total: '2 GB' })).toBe(
      '1 GB de 2 GB',
    );
    expect(format('{a} y {b}', { a: 1 })).toBe('1 y {b}');
  });

  it('has every {{t "key"}} used by the views', () => {
    const keys = filesIn(path.join(root, 'views'), '.hbs').flatMap((file) =>
      [...fs.readFileSync(file, 'utf8').matchAll(/\{\{t "([^"]+)"/g)].map(
        (m) => m[1],
      ),
    );
    expect(keys.length).toBeGreaterThan(50);
    expect(keys.filter((key) => lookup(key) === undefined)).toEqual([]);
  });

  it("has every t('key') used by the page scripts", () => {
    const keys = filesIn(path.join(root, 'public', 'js'), '.js').flatMap(
      (file) =>
        [...fs.readFileSync(file, 'utf8').matchAll(/\bt\('([^']+)'/g)].map(
          (m) => m[1],
        ),
    );
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((key) => lookup(`client.${key}`) === undefined)).toEqual(
      [],
    );
  });

  it('leaves no English UI text in the views', () => {
    // Text nodes and labels outside {{...}}: they must come from the catalog.
    const offenders = filesIn(path.join(root, 'views'), '.hbs').flatMap(
      (file) => {
        const html = fs
          .readFileSync(file, 'utf8')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<script[\s\S]*?<\/script>/g, '')
          .replace(/<svg[\s\S]*?<\/svg>/g, '')
          .replace(/\{\{[\s\S]*?\}\}/g, '');
        const texts = [
          ...html.matchAll(/>([^<]*[A-Za-z]{2,}[^<]*)</g),
          ...html.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/g),
        ].map((m) => m[1].trim());
        return texts
          .filter((text) => text && !/^(&[a-z]+;\s*)+$/.test(text))
          .map((text) => `${file}: ${text}`);
      },
    );
    expect(offenders).toEqual([]);
  });

  it('ships the client strings only', () => {
    expect(Object.keys(messages.client)).toEqual([
      'browser',
      'dashboard',
      'chat',
    ]);
  });
});
