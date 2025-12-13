/**
 * 08-llm-ask.ts
 *
 * Ask custom questions about scraped content using ask().
 * Supports both simple string responses and structured schemas.
 *
 * Run: OPENAI_API_KEY=your-key npx tsx examples/08-llm-ask.ts
 */

import { scrape } from '../src/index.js';
import { ask, createOpenAI } from '../src/llm/index.js';

async function main() {
  console.log('=== LLM ask() Example ===\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('Note: Set OPENAI_API_KEY environment variable to run this example');
    console.log('Example: OPENAI_API_KEY=sk-... npx tsx examples/08-llm-ask.ts\n');
    console.log('Showing example output structure instead:\n');

    showExampleOutput();
    return;
  }

  const llm = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  // First, scrape some content
  const data = await scrape('https://example.com');
  console.log('Scraped:', data.title, '\n');

  // Example 1: Simple question (string response)
  console.log('--- Simple Question ---');

  const q1 = await ask(data, llm, 'What is the main purpose of this page?', {
    key: 'purpose',
  });
  console.log('Purpose:', q1.custom?.purpose);

  // Example 2: Multiple questions
  console.log('\n--- Multiple Questions ---');

  const q2 = await ask(data, llm, 'Who is the target audience for this page?', {
    key: 'audience',
  });
  console.log('Audience:', q2.custom?.audience);

  const q3 = await ask(data, llm, 'What action does this page want users to take?', {
    key: 'callToAction',
  });
  console.log('Call to Action:', q3.custom?.callToAction);

  // Example 3: Structured response with schema
  console.log('\n--- Structured Response ---');

  const q4 = await ask(data, llm, 'Analyze the content of this page', {
    key: 'analysis',
    schema: {
      tone: 'string',
      complexity: 'string',
      targetAudience: 'string',
      keyPoints: 'string[]',
      hasContactInfo: 'boolean',
    },
  });
  console.log('Analysis:', JSON.stringify(q4.custom?.analysis, null, 2));

  // Example 4: Using template placeholders
  console.log('\n--- Using Placeholders ---');

  const q5 = await ask(
    data,
    llm,
    'Based on the domain {{domain}}, what industry or sector does this website belong to?',
    { key: 'industry' }
  );
  console.log('Industry:', q5.custom?.industry);

  const q6 = await ask(
    data,
    llm,
    'Given the title "{{title}}", what would you expect this page to contain?',
    { key: 'expectations' }
  );
  console.log('Expectations:', q6.custom?.expectations);

  // Example 5: Sentiment analysis
  console.log('\n--- Sentiment Analysis ---');

  const sentiment = await ask(data, llm, 'Analyze the sentiment and tone of this content', {
    key: 'sentiment',
    schema: {
      overallSentiment: 'string', // positive, negative, neutral
      confidence: 'number',
      emotionalTone: 'string[]',
      reasoning: 'string',
    },
  });
  console.log('Sentiment:', JSON.stringify(sentiment.custom?.sentiment, null, 2));

  // Example 6: Comparison/evaluation
  console.log('\n--- Content Evaluation ---');

  const evaluation = await ask(
    data,
    llm,
    'Rate this page on SEO-friendliness, accessibility, and content quality',
    {
      key: 'evaluation',
      schema: {
        seoScore: 'number',
        accessibilityScore: 'number',
        contentQualityScore: 'number',
        suggestions: 'string[]',
      },
    }
  );
  console.log('Evaluation:', JSON.stringify(evaluation.custom?.evaluation, null, 2));
}

function showExampleOutput() {
  console.log('--- Simple Question ---');
  console.log(
    'Purpose: This page serves as a placeholder domain for documentation and testing purposes.'
  );

  console.log('\n--- Structured Response ---');
  console.log(
    'Analysis:',
    JSON.stringify(
      {
        tone: 'informational',
        complexity: 'simple',
        targetAudience: 'developers and technical users',
        keyPoints: ['Placeholder domain', 'For documentation use', 'No commercial content'],
        hasContactInfo: false,
      },
      null,
      2
    )
  );

  console.log('\n--- Template Placeholders ---');
  console.log(`
Available placeholders:
  {{title}}       - Page title
  {{url}}         - Full URL
  {{content}}     - Main content text
  {{description}} - Meta description
  {{excerpt}}     - Content excerpt
  {{domain}}      - Domain name only

Example:
  await ask(data, llm,
    "For {{domain}}: What are the key points from '{{title}}'?",
    { key: 'keyPoints' }
  );
  `);

  console.log('\n--- Code Examples ---');
  console.log(`
// Simple string response
const result = await ask(data, llm, "What is this about?", {
  key: 'summary'
});
console.log(result.custom?.summary); // string

// Structured response
const analysis = await ask(data, llm, "Analyze sentiment", {
  key: 'sentiment',
  schema: {
    tone: 'string',
    score: 'number',
    keywords: 'string[]'
  }
});
console.log(analysis.custom?.sentiment); // { tone, score, keywords }
  `);
}

main().catch(console.error);
