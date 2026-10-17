import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import type { ChatCompletionTool } from '../llm/llm.service';
import { validateToolParams, type AgentTool } from './agent-tool';

export const AGENT_TOOLS = Symbol('AGENT_TOOLS');

export interface PreparedCall {
  tool: AgentTool;
  params: Record<string, unknown>;
}

@Injectable()
export class ToolRegistry {
  private readonly tools: Map<string, AgentTool>;

  constructor(@Inject(AGENT_TOOLS) tools: AgentTool[]) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
    if (this.tools.size !== tools.length) {
      throw new Error('Duplicate agent tool names');
    }
  }

  /** Tool schemas for the model. Admin-only tools are hidden from others. */
  definitionsFor(user: AuthUser): ChatCompletionTool[] {
    return [...this.tools.values()]
      .filter((t) => !t.adminOnly || user.role === 'admin')
      .map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: { ...t.parameters, additionalProperties: false },
        },
      }));
  }

  /** Resolves and validates a model tool call (name + raw JSON arguments). */
  prepare(user: AuthUser, name: string, rawArguments: string): PreparedCall {
    const tool = this.tools.get(name);
    if (!tool) throw new BadRequestException(`Unknown tool: ${name}`);
    if (tool.adminOnly && user.role !== 'admin') {
      throw new ForbiddenException(
        `Tool ${name} is only available to administrators`,
      );
    }
    let raw: unknown;
    try {
      raw = rawArguments ? JSON.parse(rawArguments) : {};
    } catch {
      throw new BadRequestException(`Arguments for ${name} are not valid JSON`);
    }
    return { tool, params: validateToolParams(tool.parameters, raw) };
  }

  run(call: PreparedCall, user: AuthUser): Promise<unknown> {
    return call.tool.run(call.params, { user });
  }
}
