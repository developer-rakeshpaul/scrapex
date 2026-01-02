/**
 * 21-embeddings.ts
 *
 * Generate embeddings from text or scraped content.
 * Demonstrates provider configuration and scrapeHtml integration.
 *
 * Run: npx tsx examples/21-embeddings.ts
 */

import { scrapeHtml } from '../src/index.js';
import {
  type EmbeddingProvider,
  createOllamaEmbedding,
  createOpenAIEmbedding,
  embed,
} from '../src/embeddings/index.js';

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const mockProvider: EmbeddingProvider = {
  name: 'mock-embeddings',
  async embed(texts) {
    return {
      embeddings: texts.map((text) => {
        const hash = hashText(text);
        return Array.from({ length: 8 }, (_, i) => ((hash + i) % 1000) / 1000);
      }),
    };
  },
};

async function main() {
  console.log('=== Embeddings Example ===\n');

  const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL;
  const ollamaBaseUrl = process.env.OLLAMA_EMBEDDING_URL;

  const provider =
    ollamaModel
      ? createOllamaEmbedding({
          model: ollamaModel,
          baseUrl: ollamaBaseUrl,
        })
      : process.env.OPENAI_API_KEY
        ? createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY })
        : mockProvider;

  if (ollamaModel) {
    console.log(`Using Ollama embeddings model: ${ollamaModel}\n`);
  } else if (!process.env.OPENAI_API_KEY) {
    console.log('Note: OPENAI_API_KEY not set. Using mock embeddings.\n');
  }

  // Example 1: Embed raw text
  const textResult = await embed('Embeddings turn text into vectors.', {
    provider: { type: 'custom', provider },
  });

  if (textResult.status === 'success' && textResult.aggregation !== 'all') {
    console.log('Text embedding dims:', textResult.vector.length);
  }

  // Example 2: Embed scraped content (offline HTML)
  const html = `
    <html>
      <head>
        <title>Embedding Demo</title>
        <meta name="description" content="Short demo article for embeddings." />
      </head>
      <body>
        <article>
          <h1>Embedding Demo</h1>
          <p>This article explains how embeddings help with semantic search.</p>
          <p>Vectors make it easier to compare meaning between texts.</p>
        </article>
      </body>
    </html>
  `;

  const scraped = await scrapeHtml(html, 'https://example.com/embeddings', {
    embeddings: {
      provider: { type: 'custom', provider },
      input: { type: 'textContent' },
      output: { aggregation: 'average' },
    },
  });

  if (scraped.embeddings?.status === 'success') {
    const vector =
      scraped.embeddings.aggregation === 'all'
        ? scraped.embeddings.vectors[0]
        : scraped.embeddings.vector;
    console.log('Scraped embedding dims:', vector.length);
    console.log('Chunks processed:', scraped.embeddings.source.chunks);
  }
}

main().catch(console.error);
