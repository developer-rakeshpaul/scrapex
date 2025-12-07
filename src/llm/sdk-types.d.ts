/**
 * Type stubs for optional peer dependencies.
 * These are only used for type checking when the actual SDK is not installed.
 */

declare module '@anthropic-ai/sdk' {
  export interface MessageCreateParams {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
    system?: string;
    temperature?: number;
  }

  export interface ContentBlock {
    type: 'text' | 'tool_use';
    text?: string;
  }

  export interface Message {
    content: ContentBlock[];
  }

  export class Anthropic {
    constructor(config: { apiKey: string; baseURL?: string });
    messages: {
      create(params: MessageCreateParams): Promise<Message>;
    };
  }
}

declare module 'openai' {
  export interface ChatCompletionMessageParam {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  export interface ChatCompletionCreateParams {
    model: string;
    max_tokens?: number;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    response_format?: { type: 'json_object' | 'text' };
  }

  export interface ChatCompletionMessage {
    content: string | null;
  }

  export interface ChatCompletionChoice {
    message: ChatCompletionMessage;
  }

  export interface ChatCompletion {
    choices: ChatCompletionChoice[];
  }

  export class OpenAI {
    constructor(config: { apiKey: string; baseURL?: string });
    chat: {
      completions: {
        create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
      };
    };
  }
}
