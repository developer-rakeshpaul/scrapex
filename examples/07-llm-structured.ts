/**
 * 07-llm-structured.ts
 *
 * Extract structured data using custom schemas.
 * The LLM will return data matching your exact schema.
 *
 * Run: OPENAI_API_KEY=your-key npx tsx examples/07-llm-structured.ts
 */

import { scrape } from '../src/index.js';
import { createOpenAI, extract } from '../src/llm/index.js';

async function main() {
  console.log('=== LLM Structured Extraction Example ===\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('Note: Set OPENAI_API_KEY environment variable to run this example');
    console.log('Example: OPENAI_API_KEY=sk-... npx tsx examples/07-llm-structured.ts\n');
    console.log('Showing example output structure instead:\n');

    showExampleOutput();
    return;
  }

  const llm = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  // Example 1: Extract article metadata
  console.log('--- Article Extraction ---');

  const articleResult = await scrape('https://example.com', {
    llm,
    extract: {
      headline: 'string',
      author: 'string?', // Optional field (suffix with ?)
      publishDate: 'string?',
      mainTopics: 'string[]',
      wordCount: 'number',
      isOpinion: 'boolean',
    },
  });

  console.log('Extracted article data:');
  console.log(JSON.stringify(articleResult.extracted, null, 2));

  // Example 2: Extract product information
  console.log('\n--- Product Extraction ---');

  interface ProductInfo {
    name: string;
    price: number;
    currency: string;
    features: string[];
    inStock: boolean;
    rating?: number;
  }

  // Using the extract() function directly for more control
  const data = await scrape('https://example.com');

  const product = await extract<ProductInfo>(
    data,
    llm,
    {
      name: 'string',
      price: 'number',
      currency: 'string',
      features: 'string[]',
      inStock: 'boolean',
      rating: 'number?',
    },
    // Optional: Custom prompt template
    'Extract product information from this e-commerce page: {{content}}'
  );

  console.log('Extracted product:');
  console.log(JSON.stringify(product, null, 2));

  // Example 3: Extract job posting
  console.log('\n--- Job Posting Extraction ---');

  const jobResult = await scrape('https://example.com', {
    llm,
    extract: {
      jobTitle: 'string',
      company: 'string',
      location: 'string',
      salaryMin: 'number?',
      salaryMax: 'number?',
      requirements: 'string[]',
      benefits: 'string[]',
      isRemote: 'boolean',
    },
  });

  console.log('Extracted job posting:');
  console.log(JSON.stringify(jobResult.extracted, null, 2));
}

function showExampleOutput() {
  console.log('--- Article Extraction ---');
  console.log('Extracted article data:');
  console.log(
    JSON.stringify(
      {
        headline: 'Example Domain',
        author: null,
        publishDate: null,
        mainTopics: ['web development', 'documentation'],
        wordCount: 45,
        isOpinion: false,
      },
      null,
      2
    )
  );

  console.log('\n--- Product Extraction ---');
  console.log('Extracted product:');
  console.log(
    JSON.stringify(
      {
        name: 'Widget Pro',
        price: 99.99,
        currency: 'USD',
        features: ['Fast performance', 'Easy to use', '24/7 support'],
        inStock: true,
        rating: 4.5,
      },
      null,
      2
    )
  );

  console.log('\n--- Schema Types ---');
  console.log(`
Available field types:
  - 'string'    → Text field
  - 'number'    → Numeric field
  - 'boolean'   → True/false field
  - 'string[]'  → Array of strings
  - 'number[]'  → Array of numbers
  - 'field?'    → Optional (append ? to any type)

Example schema:
{
  title: 'string',
  price: 'number',
  tags: 'string[]',
  isAvailable: 'boolean',
  discount: 'number?',  // optional
}
  `);
}

main().catch(console.error);
