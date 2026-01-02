# scrapex Examples

This directory contains example scripts demonstrating various scrapex features.

## Running Examples

All examples are TypeScript files that can be run directly with `tsx`:

```bash
# From the project root directory
npx tsx examples/01-basic-scraping.ts

# Or run any example
npx tsx examples/11-markdown-parsing.ts
```

> **Note:** Examples use relative imports from `../src/` to work in the development environment without needing to build the package first.
>
> Some examples require network access. `16-offline-crawl.ts` is fully offline and deterministic.

For cloud LLM examples (05-08, 10), set your API key:

```bash
OPENAI_API_KEY=sk-... npx tsx examples/05-llm-summarize.ts
```

For local LLM example (09), run Docker Model Runner or Ollama.
Learn more: https://www.docker.com/blog/run-llms-locally/

```bash
# Option 1: Docker Model Runner (Docker Desktop 4.40+)
# Enable in Settings > Features in development > Docker Model Runner
docker model list                              # List available models
docker model pull ai/smollm2:360M-Q4_K_M       # Pull a model

# Option 2: Ollama in Docker
docker run -d -p 11434:11434 --name ollama ollama/ollama
docker exec ollama ollama pull llama3.2

# Run the example (auto-detects provider)
npx tsx examples/09-llm-local-docker.ts

# Or specify custom endpoint via environment variables
LLM_URL=http://localhost:12434/engines/v1/chat/completions LLM_MODEL=ai/smollm2:360M-Q4_K_M npx tsx examples/09-llm-local-docker.ts
```

For the Puppeteer example (18), install the optional peer dependency:

```bash
npm install puppeteer
```

For the embeddings example (21), you can use Ollama by setting:

```bash
OLLAMA_EMBEDDING_MODEL=nomic-embed-text npx tsx examples/21-embeddings.ts
# Optional: OLLAMA_EMBEDDING_URL=http://localhost:11434/api/embeddings
```

## Examples Overview

### Core Scraping

| Example | Description |
|---------|-------------|
| [01-basic-scraping.ts](./01-basic-scraping.ts) | Simple scraping basics - metadata, content, links |
| [02-scrape-options.ts](./02-scrape-options.ts) | All configuration options - timeout, userAgent, etc. |
| [03-scrape-html.ts](./03-scrape-html.ts) | Scrape from HTML string (pre-fetched content) |
| [04-custom-extractors.ts](./04-custom-extractors.ts) | Build custom extractors for domain-specific data |

### LLM Integration

| Example | Description |
|---------|-------------|
| [05-llm-summarize.ts](./05-llm-summarize.ts) | AI-powered summarization and tag extraction |
| [06-llm-entities.ts](./06-llm-entities.ts) | Extract named entities (people, orgs, tech, etc.) |
| [07-llm-structured.ts](./07-llm-structured.ts) | Extract structured data with custom schemas |
| [08-llm-ask.ts](./08-llm-ask.ts) | Ask custom questions about scraped content |
| [09-llm-local-docker.ts](./09-llm-local-docker.ts) | Run LLMs locally with Docker (Model Runner, Ollama) |
| [10-llm-providers.ts](./10-llm-providers.ts) | Configure different LLM providers (OpenAI, Anthropic) |

### Parsers

| Example | Description |
|---------|-------------|
| [11-markdown-parsing.ts](./11-markdown-parsing.ts) | Parse markdown into sections, links, code blocks |
| [12-github-parsing.ts](./12-github-parsing.ts) | GitHub-specific URL parsing and utilities |
| [20-rss-parsing.ts](./20-rss-parsing.ts) | Parse RSS/Atom feeds and convert to Markdown |

### Embeddings

| Example | Description |
|---------|-------------|
| [21-embeddings.ts](./21-embeddings.ts) | Generate embeddings from text or scraped content |

### Advanced

| Example | Description |
|---------|-------------|
| [13-error-handling.ts](./13-error-handling.ts) | Error codes, retry patterns, graceful degradation |
| [14-robots-txt.ts](./14-robots-txt.ts) | Check robots.txt and respectful scraping |
| [15-batch-scraping.ts](./15-batch-scraping.ts) | Scrape multiple URLs with rate limiting |
| [16-offline-crawl.ts](./16-offline-crawl.ts) | Fully offline crawl with a custom fetcher + link extraction |
| [17-custom-fetcher-retry-cache.ts](./17-custom-fetcher-retry-cache.ts) | Fetch-layer cache + retry/backoff via custom fetcher |
| [18-puppeteer-fetcher.ts](./18-puppeteer-fetcher.ts) | Scrape JavaScript-rendered pages via Puppeteer fetcher |
| [19-extractor-pipeline-debug.ts](./19-extractor-pipeline-debug.ts) | Debug extractor ordering, dependencies, and failure handling |
| [20-rss-parsing.ts](./20-rss-parsing.ts) | Parse RSS/Atom feeds and convert to markdown |
| [21-embeddings.ts](./21-embeddings.ts) | Generate embeddings from text or scraped content |

## Practice Sites

The examples use these practice sites designed for web scraping:

| Site | URL | Description |
|------|-----|-------------|
| Books to Scrape | https://books.toscrape.com | Fake bookstore with products, categories, pagination |
| Quotes to Scrape | https://quotes.toscrape.com | Inspirational quotes with authors and tags |
| Hacker News | https://news.ycombinator.com | Real site with simple HTML structure |
| Example.com | https://example.com | Simple reference page |

### Verify Sites

Run the verification script to test connectivity:

```bash
npx tsx examples/00-verify-sites.ts
```

## Quick Start

### Basic Scraping

```typescript
import { scrape } from 'scrapex';

const result = await scrape('https://example.com');
console.log(result.title);
console.log(result.content);
```

### With LLM Enhancement

```typescript
import { scrape } from 'scrapex';
import { createOpenAI } from 'scrapex/llm';

const llm = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const result = await scrape('https://example.com', {
  llm,
  enhance: ['summarize', 'entities'],
});

console.log(result.summary);
console.log(result.entities);
```

### Custom Questions

```typescript
import { scrape } from 'scrapex';
import { createOpenAI, ask } from 'scrapex/llm';

const llm = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const data = await scrape('https://example.com');

const result = await ask(data, llm, 'What is the main topic?', {
  key: 'topic',
});

console.log(result.custom?.topic);
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for LLM features |
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative) |
| `GITHUB_TOKEN` | GitHub token for repo metadata (optional) |
| `OLLAMA_EMBEDDING_MODEL` | Ollama embedding model name (optional) |
| `OLLAMA_EMBEDDING_URL` | Ollama embedding endpoint URL (optional) |

## Learn More

- [Documentation](https://scrapex.binaryroute.com)
- [API Reference](https://scrapex.binaryroute.com/api/scrape)
- [GitHub Repository](https://github.com/developer-rakeshpaul/scrapex)
