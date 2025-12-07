import { z } from 'zod';
import type {
  EnhancementType,
  ExtractedEntities,
  ExtractionSchema,
  ScrapedData,
} from '@/core/types.js';
import type { LLMProvider } from './types.js';
import { ClassifySchema, EntitiesSchema, SummarySchema, TagsSchema } from './types.js';

/**
 * Enhance scraped data with LLM-powered features
 */
export async function enhance(
  data: ScrapedData,
  provider: LLMProvider,
  types: EnhancementType[]
): Promise<Partial<ScrapedData>> {
  const results: Partial<ScrapedData> = {};

  // Prepare content for LLM (use excerpt/textContent to save tokens)
  const content = data.excerpt || data.textContent.slice(0, 10000);
  const context = `Title: ${data.title}\nURL: ${data.url}\n\nContent:\n${content}`;

  // Run enhancements in parallel
  const promises: Promise<void>[] = [];

  if (types.includes('summarize')) {
    promises.push(
      summarize(context, provider).then((summary) => {
        results.summary = summary;
      })
    );
  }

  if (types.includes('tags')) {
    promises.push(
      extractTags(context, provider).then((tags) => {
        results.suggestedTags = tags;
      })
    );
  }

  if (types.includes('entities')) {
    promises.push(
      extractEntities(context, provider).then((entities) => {
        results.entities = entities;
      })
    );
  }

  if (types.includes('classify')) {
    promises.push(
      classify(context, provider).then((classification) => {
        if (classification.confidence > 0.7) {
          results.contentType = classification.contentType as ScrapedData['contentType'];
        }
      })
    );
  }

  await Promise.all(promises);

  return results;
}

/**
 * Options for the ask() function
 */
export interface AskOptions {
  /** Key to store the result under in custom field */
  key?: string;
  /** Schema for structured response */
  schema?: ExtractionSchema;
}

/**
 * Ask a custom question about the scraped content
 * Results are stored in the `custom` field of ScrapedData
 */
export async function ask(
  data: ScrapedData,
  provider: LLMProvider,
  prompt: string,
  options?: AskOptions
): Promise<Partial<ScrapedData>> {
  const key = options?.key || 'response';
  const content = data.excerpt || data.textContent.slice(0, 10000);

  // Apply placeholder replacements
  const processedPrompt = applyPlaceholders(prompt, data, content);

  if (options?.schema) {
    // Use structured extraction
    const result = await extract(data, provider, options.schema, processedPrompt);
    return { custom: { [key]: result } };
  }

  // Simple string response
  const fullPrompt = prompt.includes('{{content}}')
    ? processedPrompt
    : `${processedPrompt}\n\nTitle: ${data.title}\nURL: ${data.url}\n\nContent:\n${content}`;

  const response = await provider.complete(fullPrompt);
  return { custom: { [key]: response } };
}

/**
 * Apply placeholder replacements to a prompt template
 */
function applyPlaceholders(prompt: string, data: ScrapedData, content: string): string {
  const domain = (() => {
    try {
      return new URL(data.url).hostname;
    } catch {
      return '';
    }
  })();

  return prompt
    .replace(/\{\{title\}\}/g, data.title)
    .replace(/\{\{url\}\}/g, data.url)
    .replace(/\{\{content\}\}/g, content)
    .replace(/\{\{description\}\}/g, data.description || '')
    .replace(/\{\{excerpt\}\}/g, data.excerpt || '')
    .replace(/\{\{domain\}\}/g, domain);
}

/**
 * Extract structured data using LLM and a custom schema
 */
export async function extract<T>(
  data: ScrapedData,
  provider: LLMProvider,
  schema: ExtractionSchema,
  promptTemplate?: string
): Promise<T> {
  // Convert simple schema to Zod schema
  const zodShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, type] of Object.entries(schema)) {
    const isOptional = type.endsWith('?');
    const baseType = isOptional ? type.slice(0, -1) : type;

    let zodType: z.ZodTypeAny;
    switch (baseType) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'string[]':
        zodType = z.array(z.string());
        break;
      case 'number[]':
        zodType = z.array(z.number());
        break;
      default:
        zodType = z.string();
    }

    zodShape[key] = isOptional ? zodType.optional() : zodType;
  }

  const zodSchema = z.object(zodShape) as unknown as z.ZodType<T>;

  const content = data.textContent.slice(0, 4000);

  let prompt: string;

  if (promptTemplate) {
    // Apply all placeholder replacements
    prompt = applyPlaceholders(promptTemplate, data, content);

    // If content wasn't included via placeholder, append it
    if (!promptTemplate.includes('{{content}}')) {
      prompt += `\n\nContext:\n${content}`;
    }
  } else {
    prompt = `Extract the following information from this content:

Title: ${data.title}
URL: ${data.url}

Content:
${content}

Extract these fields:
${Object.entries(schema)
  .map(([key, type]) => `- ${key} (${type})`)
  .join('\n')}`;
  }

  return provider.completeJSON<T>(prompt, zodSchema as z.ZodType<T>);
}

/**
 * Generate a summary of the content
 */
async function summarize(context: string, provider: LLMProvider): Promise<string> {
  const prompt = `Summarize the following content in 2-3 concise sentences:

${context}`;

  const result = await provider.completeJSON(prompt, SummarySchema);
  return result.summary;
}

/**
 * Extract relevant tags/keywords
 */
async function extractTags(context: string, provider: LLMProvider): Promise<string[]> {
  const prompt = `Extract 5-10 relevant tags or keywords from the following content. Focus on technologies, concepts, and topics mentioned:

${context}`;

  const result = await provider.completeJSON(prompt, TagsSchema);
  return result.tags;
}

/**
 * Extract named entities from content
 */
async function extractEntities(context: string, provider: LLMProvider): Promise<ExtractedEntities> {
  const prompt = `Extract named entities from the following content. Identify people, organizations, technologies, locations, and key concepts:

${context}`;

  return provider.completeJSON(prompt, EntitiesSchema);
}

/**
 * Classify content type using LLM
 */
async function classify(
  context: string,
  provider: LLMProvider
): Promise<{ contentType: string; confidence: number }> {
  const prompt = `Classify the following content into one of these categories:
- article: Blog post, news article, essay
- repo: Code repository, open source project
- docs: Documentation, API reference, guides
- package: npm/pip package page
- video: Video content, YouTube
- tool: Software tool, web application
- product: Commercial product, e-commerce

${context}`;

  return provider.completeJSON(prompt, ClassifySchema);
}
