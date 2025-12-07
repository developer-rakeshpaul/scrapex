import { z } from 'zod';

/**
 * LLM completion options
 */
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * LLM Provider interface - implemented by all providers
 */
export interface LLMProvider {
  readonly name: string;

  /**
   * Generate a text completion
   */
  complete(prompt: string, options?: CompletionOptions): Promise<string>;

  /**
   * Generate a structured JSON completion with Zod validation
   */
  completeJSON<T>(prompt: string, schema: z.ZodType<T>, options?: CompletionOptions): Promise<T>;
}

/**
 * Provider configuration for Anthropic
 */
export interface AnthropicConfig {
  apiKey?: string; // Falls back to ANTHROPIC_API_KEY env var
  model?: string; // Default: claude-3-haiku-20240307
  baseUrl?: string;
}

/**
 * Provider configuration for OpenAI-compatible APIs
 * Works with: OpenAI, Ollama, LM Studio, LocalAI, vLLM, etc.
 */
export interface OpenAICompatibleConfig {
  apiKey?: string; // Falls back to OPENAI_API_KEY env var
  model?: string; // Default: gpt-4o-mini
  baseUrl?: string; // Default: https://api.openai.com/v1
}

/**
 * Enhancement result types
 */
export interface SummaryResult {
  summary: string;
}

export interface TagsResult {
  tags: string[];
}

export interface EntitiesResult {
  people: string[];
  organizations: string[];
  technologies: string[];
  locations: string[];
  concepts: string[];
}

export interface ClassifyResult {
  contentType: string;
  confidence: number;
}

/**
 * Zod schemas for LLM outputs
 */
export const SummarySchema = z.object({
  summary: z.string().describe('A concise 2-3 sentence summary of the content'),
});

export const TagsSchema = z.object({
  tags: z.array(z.string()).describe('5-10 relevant tags/keywords'),
});

export const EntitiesSchema = z.object({
  people: z.array(z.string()).describe('People mentioned'),
  organizations: z.array(z.string()).describe('Organizations/companies'),
  technologies: z.array(z.string()).describe('Technologies/tools/frameworks'),
  locations: z.array(z.string()).describe('Locations/places'),
  concepts: z.array(z.string()).describe('Key concepts/topics'),
});

export const ClassifySchema = z.object({
  contentType: z
    .enum(['article', 'repo', 'docs', 'package', 'video', 'tool', 'product', 'unknown'])
    .describe('The type of content'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
});
