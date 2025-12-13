/**
 * 05-llm-summarize.ts
 *
 * Use LLM to generate summaries and tags from scraped content.
 *
 * Run: OPENAI_API_KEY=your-key npx tsx examples/05-llm-summarize.ts
 */

import { scrape } from '../src/index.js';
import { createOpenAI } from '../src/llm/index.js';

async function main() {
  console.log('=== LLM Summarization Example ===\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('Note: Set OPENAI_API_KEY environment variable to run this example');
    console.log('Example: OPENAI_API_KEY=sk-... npx tsx examples/05-llm-summarize.ts\n');
    console.log('Showing example output structure instead:\n');

    showExampleOutput();
    return;
  }

  // Create LLM provider
  const llm = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini', // Cost-effective model for summarization
  });

  // Scrape with summarization
  // Using quotes.toscrape.com - has rich content for summarization
  console.log('Scraping and summarizing...\n');

  const result = await scrape('https://quotes.toscrape.com', {
    llm,
    enhance: ['summarize'], // Request summary generation
  });

  console.log('--- Page Info ---');
  console.log('Title:', result.title);
  console.log('URL:', result.url);

  console.log('\n--- AI-Generated Summary ---');
  console.log(result.summary || 'No summary generated');

  // Scrape with tags
  console.log('\n--- Adding Tag Extraction ---');

  const resultWithTags = await scrape('https://quotes.toscrape.com', {
    llm,
    enhance: ['summarize', 'tags'], // Request both summary and tags
  });

  console.log('Summary:', resultWithTags.summary);
  console.log('Suggested Tags:', resultWithTags.suggestedTags?.join(', ') || 'None');

  // Combine with content limiting for token optimization
  console.log('\n--- Token-Optimized Scraping ---');

  const optimized = await scrape('https://quotes.toscrape.com', {
    llm,
    enhance: ['summarize', 'tags'],
    maxContentLength: 5000, // Limit content to reduce token usage
  });

  console.log('Content length:', optimized.textContent.length, 'chars');
  console.log('Summary:', optimized.summary);
}

function showExampleOutput() {
  console.log('--- Page Info ---');
  console.log('Title: Quotes to Scrape');
  console.log('URL: https://quotes.toscrape.com');

  console.log('\n--- AI-Generated Summary ---');
  console.log(
    'Quotes to Scrape is a practice website featuring inspirational quotes ' +
      'from famous authors. It includes pagination, tags, and author pages, ' +
      'making it ideal for learning web scraping techniques.'
  );

  console.log('\n--- Suggested Tags ---');
  console.log('quotes, inspiration, authors, web scraping, practice');

  console.log('\n--- Code Example ---');
  console.log(`
import { scrape } from 'scrapex';
import { createOpenAI } from 'scrapex/llm';

const llm = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const result = await scrape('https://quotes.toscrape.com', {
  llm,
  enhance: ['summarize', 'tags'],
});

console.log(result.summary);       // AI-generated summary
console.log(result.suggestedTags); // ['quotes', 'inspiration', ...]
  `);
}

main().catch(console.error);
