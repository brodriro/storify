import * as fs from 'fs';
import * as path from 'path';

/**
 * WCAG 2.x contrast of the design tokens (plan U3). Reads public/css/tokens.css
 * so a colour change that breaks AA fails the build.
 */
const css = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'css', 'tokens.css'),
  'utf8',
);

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block for ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  const [r, g, b] = channels.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5; // normal text
const UI = 3; // non-text: control borders, focus ring, icons

const pairs: [string, string, number][] = [
  ['--text', '--bg', TEXT],
  ['--text', '--surface', TEXT],
  ['--text', '--surface-hover', TEXT],
  ['--text-muted', '--bg', TEXT],
  ['--text-muted', '--surface', TEXT],
  ['--text-muted', '--surface-hover', TEXT],
  ['--accent-text', '--bg', TEXT],
  ['--accent-text', '--surface', TEXT],
  ['--on-accent', '--accent', TEXT],
  ['--on-accent', '--accent-hover', TEXT],
  ['--on-danger', '--danger', TEXT],
  ['--on-danger', '--danger-hover', TEXT],
  ['--danger-text', '--bg', TEXT],
  ['--danger-text', '--surface', TEXT],
  ['--code-text', '--surface', TEXT],
  ['--border-strong', '--surface', UI],
  ['--border-strong', '--bg', UI],
  ['--focus-ring', '--bg', UI],
  ['--focus-ring', '--surface', UI],
  ['--accent', '--surface', UI],
];

describe.each([
  ['light', ':root'],
  ['dark', ":root[data-theme='dark']"],
])('%s theme contrast (WCAG AA)', (_name, selector) => {
  const light = block(':root');
  const tokens = { ...light, ...block(selector) };

  it.each(pairs)('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
  });
});

it('keeps the no-JS dark block identical to the dark theme', () => {
  const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
  const noJs = Object.fromEntries(
    [...media.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
  expect(noJs).toEqual(block(":root[data-theme='dark']"));
});
