/**
 * 09-llm-local-docker.ts
 *
 * Use local LLMs running in Docker containers.
 * Supports Docker Model Runner, Ollama, and other OpenAI-compatible servers.
 *
 * Setup options:
 *
 * 1. Docker Model Runner (Docker Desktop 4.40+):
 *    - Enable in Docker Desktop Settings > Features in development > Docker Model Runner
 *    - Models run at: http://localhost:12434/engines/llama.cpp/v1
 *
 * 2. Ollama in Docker:
 *    docker run -d -p 11434:11434 --name ollama ollama/ollama
 *    docker exec ollama ollama pull llama3.2
 *
 * 3. LM Studio:
 *    - Download from https://lmstudio.ai
 *    - Load a model and start local server (default port 1234)
 *
 * Run: npx tsx examples/09-llm-local-docker.ts
 */

import { scrape } from '../src/index.js';
import type { LLMProvider } from '../src/llm/index.js';
import { createLMStudio, createOllama, createOpenAI } from '../src/llm/index.js';

// Docker Model Runner configuration
const DOCKER_MODEL_RUNNER = {
  baseUrl: 'http://localhost:12434/engines/llama.cpp/v1',
  model: 'ai/llama3.2:1B-Q8_0', // Lightweight model for testing
};

// Ollama Docker configuration
const OLLAMA_DOCKER = {
  baseUrl: 'http://localhost:11434/v1',
  port: 11434,
  model: 'llama3.2',
};

// LM Studio configuration
const LM_STUDIO = {
  baseUrl: 'http://localhost:1234/v1',
  port: 1234,
  model: 'local-model',
};

async function checkEndpoint(url: string): Promise<boolean> {
  try {
    const response = await fetch(url.replace('/v1', ''), {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function detectProvider(): Promise<{ provider: LLMProvider; name: string } | null> {
  console.log('Detecting available local LLM providers...\n');

  // Check Docker Model Runner
  console.log('  Checking Docker Model Runner...');
  if (await checkEndpoint(DOCKER_MODEL_RUNNER.baseUrl)) {
    console.log('  ✓ Docker Model Runner available');
    try {
      return {
        provider: createOpenAI({
          baseUrl: DOCKER_MODEL_RUNNER.baseUrl,
          apiKey: 'not-needed', // Local doesn't need API key
          model: DOCKER_MODEL_RUNNER.model,
        }),
        name: 'Docker Model Runner',
      };
    } catch (error) {
      console.log(`    Error: ${(error as Error).message}`);
    }
  } else {
    console.log('  ✗ Not available');
  }

  // Check Ollama
  console.log('  Checking Ollama...');
  if (await checkEndpoint(OLLAMA_DOCKER.baseUrl)) {
    console.log('  ✓ Ollama available');
    try {
      return {
        provider: createOllama({
          model: OLLAMA_DOCKER.model,
          port: OLLAMA_DOCKER.port,
        }),
        name: 'Ollama',
      };
    } catch (error) {
      console.log(`    Error: ${(error as Error).message}`);
    }
  } else {
    console.log('  ✗ Not available');
  }

  // Check LM Studio
  console.log('  Checking LM Studio...');
  if (await checkEndpoint(LM_STUDIO.baseUrl)) {
    console.log('  ✓ LM Studio available');
    try {
      return {
        provider: createLMStudio({ model: LM_STUDIO.model, port: LM_STUDIO.port }),
        name: 'LM Studio',
      };
    } catch (error) {
      console.log(`    Error: ${(error as Error).message}`);
    }
  } else {
    console.log('  ✗ Not available');
  }

  return null;
}

async function main() {
  console.log('=== Local LLM with Docker Example ===\n');

  // Show setup instructions
  console.log('--- Setup Instructions ---');
  console.log(`
Prerequisites:
  npm install openai  # Required for OpenAI-compatible APIs

Option 1: Docker Model Runner (Recommended)
  - Requires Docker Desktop 4.40+
  - Enable: Settings > Features in development > Docker Model Runner
  - Pull model: docker model pull ai/llama3.2:1B-Q8_0

Option 2: Ollama in Docker
  docker run -d -p 11434:11434 --name ollama ollama/ollama
  docker exec ollama ollama pull llama3.2

Option 3: LM Studio
  - Download from https://lmstudio.ai
  - Load a model and start the local server
`);

  // Detect available provider
  const detected = await detectProvider();

  if (!detected) {
    console.log('\n--- No Local LLM Found ---');
    console.log('Please start one of the local LLM servers listed above.');
    console.log('\nShowing example code structure:\n');
    showExampleCode();
    return;
  }

  console.log(`--- Using ${detected.name} ---\n`);

  try {
    // Test with a simple scrape
    console.log('Scraping and summarizing with local LLM...\n');

    const result = await scrape('https://quotes.toscrape.com', {
      llm: detected.provider,
      enhance: ['summarize', 'tags'],
      maxContentLength: 3000, // Keep small for faster local processing
    });

    console.log('Title:', result.title);
    console.log('Summary:', result.summary || '(no summary generated)');
    console.log('Tags:', result.suggestedTags?.join(', ') || '(no tags)');
    console.log(`\nProcessed in ${result.scrapeTimeMs}ms`);
  } catch (error) {
    console.log('Error:', (error as Error).message);
    console.log('\nTip: Make sure the model is downloaded and the server is running.');
  }
}

function showExampleCode() {
  console.log(`
// Using Docker Model Runner
import { scrape } from 'scrapex';
import { createOpenAI } from 'scrapex/llm';

const llm = createOpenAI({
  baseUrl: 'http://localhost:12434/engines/llama.cpp/v1',
  apiKey: 'not-needed',
  model: 'ai/llama3.2:1B-Q8_0',
});

const result = await scrape('https://example.com', {
  llm,
  enhance: ['summarize'],
});

// Using Ollama in Docker
import { createOllama } from 'scrapex/llm';

const ollama = createOllama({
  model: 'llama3.2',
  port: 11434,
});

const result2 = await scrape('https://example.com', {
  llm: ollama,
  enhance: ['summarize', 'entities'],
});
  `);
}

main().catch(console.error);
