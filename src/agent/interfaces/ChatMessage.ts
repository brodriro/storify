
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ToolNas {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: { [key: string]: { type: string; description: string; required?: boolean; default?: any } };
      required: string[];
    };
  }