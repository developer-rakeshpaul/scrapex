/**
 * 06-llm-entities.ts
 *
 * Extract named entities (people, organizations, locations, etc.) using LLM.
 *
 * Run: OPENAI_API_KEY=your-key npx tsx examples/06-llm-entities.ts
 */

import { scrape } from '../src/index.js';
import { createOpenAI } from '../src/llm/index.js';

async function main() {
  console.log('=== LLM Entity Extraction Example ===\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('Note: Set OPENAI_API_KEY environment variable to run this example');
    console.log('Example: OPENAI_API_KEY=sk-... npx tsx examples/06-llm-entities.ts\n');
    console.log('Showing example output structure instead:\n');

    showExampleOutput();
    return;
  }

  // Create LLM provider
  const llm = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  // Scrape with entity extraction
  console.log('Scraping and extracting entities...\n');

  const result = await scrape('https://en.wikipedia.org/wiki/TypeScript', {
    llm,
    enhance: ['entities'],
    maxContentLength: 8000, // Limit content for faster processing
  });

  console.log('--- Page Info ---');
  console.log('Title:', result.title);

  console.log('\n--- Extracted Entities ---');

  if (result.entities) {
    console.log('\nPeople:');
    for (const p of result.entities.people) {
      console.log('  -', p);
    }

    console.log('\nOrganizations:');
    for (const o of result.entities.organizations) {
      console.log('  -', o);
    }

    console.log('\nTechnologies:');
    for (const t of result.entities.technologies) {
      console.log('  -', t);
    }

    console.log('\nLocations:');
    for (const l of result.entities.locations) {
      console.log('  -', l);
    }

    console.log('\nConcepts:');
    for (const c of result.entities.concepts) {
      console.log('  -', c);
    }
  } else {
    console.log('No entities extracted');
  }

  // Combine with other enhancements
  console.log('\n--- Full Enhancement Pipeline ---');

  const fullResult = await scrape('https://en.wikipedia.org/wiki/TypeScript', {
    llm,
    enhance: ['summarize', 'entities', 'tags', 'classify'],
    maxContentLength: 8000,
  });

  console.log('Summary:', `${fullResult.summary?.slice(0, 150)}...`);
  console.log('Tags:', fullResult.suggestedTags?.slice(0, 5).join(', '));
  console.log('Content Type:', fullResult.contentType);
  console.log('Entity Count:', {
    people: fullResult.entities?.people.length || 0,
    organizations: fullResult.entities?.organizations.length || 0,
    technologies: fullResult.entities?.technologies.length || 0,
  });
}

function showExampleOutput() {
  console.log('--- Page Info ---');
  console.log('Title: TypeScript - Wikipedia');

  console.log('\n--- Extracted Entities ---');

  console.log('\nPeople:');
  console.log('  - Anders Hejlsberg');

  console.log('\nOrganizations:');
  console.log('  - Microsoft');
  console.log('  - Google');
  console.log('  - Meta');

  console.log('\nTechnologies:');
  console.log('  - TypeScript');
  console.log('  - JavaScript');
  console.log('  - Node.js');
  console.log('  - Angular');
  console.log('  - React');

  console.log('\nLocations:');
  console.log('  - Redmond');

  console.log('\nConcepts:');
  console.log('  - static typing');
  console.log('  - type inference');
  console.log('  - object-oriented programming');

  console.log('\n--- Code Example ---');
  console.log(`
import { scrape } from 'scrapex';
import { createOpenAI } from 'scrapex/llm';

const llm = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const result = await scrape(url, {
  llm,
  enhance: ['entities'],
});

console.log(result.entities);
// {
//   people: ['Anders Hejlsberg'],
//   organizations: ['Microsoft', 'Google'],
//   technologies: ['TypeScript', 'JavaScript'],
//   locations: ['Redmond'],
//   concepts: ['static typing', 'type inference']
// }
  `);
}

main().catch(console.error);
