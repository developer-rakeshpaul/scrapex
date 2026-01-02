/**
 * 10-llm-providers.ts
 *
 * Configure different LLM providers: OpenAI, Anthropic, Ollama, LM Studio.
 *
 * Run: npx tsx examples/10-llm-providers.ts
 */

import { scrape } from "../src/index.js";
import {
  createLMStudio as _createLMStudio,
  ask,
  createAnthropic,
  createOllama,
  createOpenAI,
  type LLMProvider,
} from "../src/llm/index.js";

// Re-export for documentation (shown in console.log examples)
void _createLMStudio;

async function main() {
  console.log("=== LLM Providers Example ===\n");
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";

  // Example 1: OpenAI
  console.log("--- OpenAI Configuration ---");
  console.log(`
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Required (or set env var)
  model: 'gpt-4o-mini',                // Default model
});

// Or use GPT-4 for better quality
const gpt4 = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});
  `);

  // Example 2: Anthropic Claude
  console.log("--- Anthropic Configuration ---");
  console.log(`
import { createAnthropic } from 'scrapex/llm';

const claude = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,  // Required (or set env var)
  model: 'claude-3-5-haiku-20241022',     // Default model
});

// Or use Sonnet for better quality
const sonnet = createAnthropic({
  model: 'claude-3-5-sonnet-20241022',
});
  `);

  // Example 3: Ollama (Local)
  console.log("--- Ollama (Local) Configuration ---");
  console.log(`
// First, start Ollama: ollama serve
// Then pull a model: ollama pull llama3.2

const ollama = createOllama({
  model: 'llama3.2',    // Model name (override via OLLAMA_MODEL env var)
  // baseUrl defaults to http://localhost:11434/v1/chat/completions
});

// Custom host (e.g., Docker)
const ollamaDocker = createOllama({
  model: 'llama3.2',
  baseUrl: 'http://ollama-container:11434/v1/chat/completions',
});
  `);

  // Example 4: LM Studio (Local)
  console.log("--- LM Studio (Local) Configuration ---");
  console.log(`
// Start LM Studio and load a model
// Enable local server (default port 1234)

const lmstudio = createLMStudio({
  model: 'local-model',  // Model loaded in LM Studio
  // baseUrl defaults to http://localhost:1234/v1/chat/completions
});
  `);

  // Example 5: Azure OpenAI
  console.log("--- Azure OpenAI Configuration ---");
  console.log(`
const azure = createOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseUrl: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-01',
  model: 'your-deployment',
});
  `);

  // Example 6: Any OpenAI-compatible API
  console.log("--- Custom OpenAI-Compatible APIs ---");
  console.log(`
// Works with: Together AI, Anyscale, Fireworks, etc.

const together = createOpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseUrl: 'https://api.together.xyz/v1/chat/completions',
  model: 'meta-llama/Llama-3-70b-chat-hf',
});

const fireworks = createOpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
  model: 'accounts/fireworks/models/llama-v3-70b-instruct',
});
  `);

  // Demonstrate actual usage with available provider
  console.log("\n--- Live Demo ---");

  let provider: LLMProvider | null = null;
  let providerName = "";

  if (process.env.OPENAI_API_KEY) {
    provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    providerName = "OpenAI";
  } else if (process.env.ANTHROPIC_API_KEY) {
    provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    providerName = "Anthropic";
  } else {
    // Try local Ollama
    try {
      provider = createOllama({ model: ollamaModel });
      providerName = "Ollama (local)";
      console.log("Attempting to use local Ollama...");
    } catch {
      console.log("No LLM provider available. Set one of:");
      console.log("  - OPENAI_API_KEY");
      console.log("  - ANTHROPIC_API_KEY");
      console.log("  - Or start Ollama locally");
      return;
    }
  }

  if (provider) {
    console.log(`Using ${providerName} provider\n`);

    try {
      if (providerName.startsWith("Ollama")) {
        const data = await scrape("https://quotes.toscrape.com", {
          maxContentLength: 5000,
        });

        const summary = await ask(
          data,
          provider,
          "Summarize this page in 2-3 sentences.",
          {
            key: "summary",
          }
        );

        console.log("Title:", data.title);
        console.log("Summary:", summary.custom?.summary);
      } else {
        const result = await scrape("https://quotes.toscrape.com", {
          llm: provider,
          enhance: ["summarize"],
          maxContentLength: 5000,
        });

        console.log("Title:", result.title);
        console.log("Summary:", result.summary);
      }
    } catch (error) {
      console.log("LLM call failed:", (error as Error).message);
      console.log(
        "(This is expected if no valid API key or local model is available)"
      );
    }
  }
}

main().catch(console.error);
