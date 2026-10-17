import { es } from './es';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** 'errors.accessDenied', 'browser.title', ... (checked by the compiler). */
export type MessageKey = Leaves<typeof es>;

export const messages = es;

/** Looks up a dotted key; unknown keys come back as the key itself. */
export function lookup(key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Fills `{name}` placeholders; missing params are left as they are. */
export function format(
  template: string,
  params: Record<string, unknown> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function t(key: MessageKey, params?: Record<string, unknown>): string {
  return format(lookup(key) ?? key, params);
}

/** Strings for public/js, embedded as inert JSON with '<' escaped. */
export function clientMessagesJson(): string {
  return JSON.stringify(messages.client).replace(/</g, '\\u003c');
}
