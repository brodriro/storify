import { BadRequestException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';

type JsonType = 'string' | 'number' | 'integer' | 'boolean';

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<
    string,
    { type: JsonType; description: string; default?: unknown }
  >;
  required: string[];
  additionalProperties?: false;
}

export interface ToolContext {
  user: AuthUser;
}

/**
 * One capability the assistant can use. Schema, permissions and behaviour
 * live together; the registry exposes the schema to the model and runs the
 * tool after validating its arguments.
 */
export interface AgentTool<P extends Record<string, unknown> = any> {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameterSchema;
  /** Changes data: requires explicit user confirmation before running (D2). */
  readonly mutates: boolean;
  readonly adminOnly?: boolean;
  /** Human-readable description of a pending action, for the confirmation UI. */
  describe?(params: P): string;
  run(params: P, ctx: ToolContext): Promise<unknown>;
}

/** Strips on-disk prefixes the model sometimes echoes ("public_storage/users/..."). */
export function toStoragePath(value: string): string {
  return value
    .trim()
    .replace(/^\.?\/?(?:public_storage\/)?users\//, '')
    .replace(/^\.?\/+/, '');
}

/**
 * Validates model-supplied arguments against the (flat) schema subset tools
 * use. Unknown keys are dropped; defaults applied; types checked.
 */
export function validateToolParams(
  schema: ToolParameterSchema,
  raw: unknown,
): Record<string, unknown> {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    let value = input[key];
    if (value === undefined || value === null || value === '') {
      if (schema.required.includes(key)) {
        throw new BadRequestException(`Missing parameter: ${key}`);
      }
      if (prop.default !== undefined) result[key] = prop.default;
      continue;
    }
    if (
      (prop.type === 'number' || prop.type === 'integer') &&
      typeof value === 'string'
    ) {
      value = Number(value);
    }
    const ok =
      prop.type === 'string'
        ? typeof value === 'string'
        : prop.type === 'boolean'
          ? typeof value === 'boolean'
          : typeof value === 'number' &&
            Number.isFinite(value) &&
            (prop.type === 'number' || Number.isInteger(value));
    if (!ok) {
      throw new BadRequestException(`Parameter ${key} must be a ${prop.type}`);
    }
    result[key] = value;
  }
  return result;
}
