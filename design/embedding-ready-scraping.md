# Embedding-Ready Scraping Proposal

## Overview

Add first-class, opt-in embedding generation to `scrape()` and `scrapeHtml()` that fits the existing extractor + LLM pipeline. The feature should reuse existing `textContent` output, keep costs predictable through chunking and aggregation, and preserve raw content for other use cases.

## Goals

- Produce high-quality embeddings with minimal caller wiring.
- Keep costs predictable with chunking, throttling, and caching.
- Preserve raw content and existing scrape output behavior.
- **Remain provider-agnostic** - support OpenAI, Azure, Ollama, HuggingFace, and custom endpoints.
- **Enterprise-ready security** - PII redaction, HTTPS enforcement, compliance support.

## Non-Goals

- Replacing existing LLM enhancement or extraction.
- Mandating a specific embedding provider.
- Adding additional HTML cleaning stages beyond current `ContentExtractor` output.

## Current Architecture Fit

- `ContentExtractor` already produces `content` (markdown) and `textContent` (plain text).
- `scrape()` runs extractors, then optional LLM enhancement/extraction.
- Embeddings should be computed after extractors and before returning the final `ScrapedData`.
- If embeddings depend on LLM-derived fields (like `summary`), run after enhancement.

## Proposed API Changes

### Scrape Options

Add an optional `embeddings` block to `ScrapeOptions`:

```ts
export interface ScrapeOptions {
  // ...existing fields...
  embeddings?: EmbeddingOptions;
}
```

### Scraped Data

Add an optional `embeddings` field to `ScrapedData`:

```ts
export interface ScrapedData {
  // ...existing fields...
  embeddings?: EmbeddingResult;
}
```

### Types

New types in `src/embeddings/types.ts`:

```ts
// ─────────────────────────────────────────────────────────────
// Provider Configuration (Provider-Agnostic Design)
// ─────────────────────────────────────────────────────────────

export type EmbeddingProviderConfig =
  | { type: "http"; config: HttpEmbeddingConfig }
  | { type: "custom"; provider: EmbeddingProvider };

/**
 * Preset factories (OpenAI, Azure, Ollama, HuggingFace, Cohere, Transformers)
 * return EmbeddingProvider instances and are used via:
 * `{ type: 'custom', provider: createOpenAIEmbedding(...) }`.
 */

/**
 * Generic HTTP provider for Ollama, HuggingFace, LocalAI, etc.
 */
export interface HttpEmbeddingConfig<
  TRequest = unknown,
  TResponse = unknown,
  TError = unknown
> extends BaseHttpConfig<TError> {
  // BaseHttpConfig includes security (HTTPS/SSRF), errorMapper, headers, and resilience options.
  baseUrl: string;
  model: string;
  headers?: Record<string, string>;
  /**
   * Map provider response to embeddings array.
   * @example (res) => res.embeddings || res.data.map(d => d.embedding)
   */
  responseMapper?: (response: TResponse) => number[][];
  /**
   * Build request body from input texts.
   * @default { input: texts, model }
   */
  requestBuilder?: (texts: string[], model: string) => TRequest;
}

// ─────────────────────────────────────────────────────────────
// Input Configuration
// ─────────────────────────────────────────────────────────────

export type EmbeddingInputType = "textContent" | "title+summary" | "custom";

export interface EmbeddingInputConfig {
  /**
   * Predefined input source. Ignored if `transform` is provided.
   */
  type?: EmbeddingInputType; // default: 'textContent'
  /**
   * Custom function to generate input text from scraped data.
   * Enables dynamic construction (e.g., "Combine price + title").
   */
  transform?: (data: Partial<ScrapedData>) => string;
  /**
   * Static custom input string. Used when type is 'custom'.
   */
  customText?: string;
}

// ─────────────────────────────────────────────────────────────
// Chunking Configuration
// ─────────────────────────────────────────────────────────────

export interface ChunkingConfig {
  /**
   * Target chunk size in tokens. Default: 500.
   */
  size?: number;
  /**
   * Overlap between chunks in tokens. Default: 50.
   */
  overlap?: number;
  /**
   * Token counting strategy.
   * - 'heuristic': chars / 4 (fast, approximate)
   * - 'tiktoken': accurate for OpenAI models (lazy-loaded)
   * - function: custom tokenizer
   */
  tokenizer?: "heuristic" | "tiktoken" | ((text: string) => number);
  /**
   * Hard cap on input length (characters) to prevent memory exhaustion.
   * Default: 100000 (100KB).
   */
  maxInputLength?: number;
}

// ─────────────────────────────────────────────────────────────
// Output Configuration
// ─────────────────────────────────────────────────────────────

export type EmbeddingAggregation =
  | "average" // Average all chunk vectors (default)
  | "max" // Element-wise maximum
  | "first" // Use first chunk only
  | "all"; // Return all chunk vectors

export interface OutputConfig {
  aggregation?: EmbeddingAggregation; // default: 'average'
  dimensions?: number; // Model-specific dimension override
}

// ─────────────────────────────────────────────────────────────
// Safety & Compliance Configuration
// ─────────────────────────────────────────────────────────────

export interface SafetyConfig {
  /**
   * PII redaction patterns to apply before embedding.
   * Critical for GDPR/CCPA compliance with third-party APIs.
   */
  piiRedaction?: {
    email?: boolean; // Redact email addresses
    phone?: boolean; // Redact phone numbers
    creditCard?: boolean; // Redact credit card numbers
    ssn?: boolean; // Redact SSN patterns
    ipAddress?: boolean; // Redact IP addresses
    customPatterns?: RegExp[]; // Additional patterns
  };
  /**
   * Minimum text length to proceed with embedding.
   * Skips with reason if below threshold.
   */
  minTextLength?: number;
  /**
   * Maximum tokens per API request to prevent billing DoS.
   */
  maxTokens?: number; // default: 8192
  /**
   * Explicitly opt-in to receive sensitive data in callbacks.
   * When false (default), onChunk receives redacted content.
   */
  allowSensitiveCallbacks?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Cache Configuration
// ─────────────────────────────────────────────────────────────

export interface EmbeddingCacheConfig {
  /**
   * Cache implementation.
   */
  store?: EmbeddingCache;
  /**
   * Time-to-live in milliseconds.
   */
  ttlMs?: number;
  /**
   * Maximum entries for in-memory cache.
   */
  maxEntries?: number;
  /**
   * Extra salt to disambiguate cache keys for custom providers/transforms.
   */
  cacheKeySalt?: string;
}

export interface EmbeddingCache {
  get(key: string): Promise<EmbeddingResult | undefined>;
  set(
    key: string,
    value: EmbeddingResult,
    options?: { ttlMs?: number }
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Resilience Configuration
// ─────────────────────────────────────────────────────────────

export interface ResilienceConfig {
  /**
   * Retry configuration for transient failures.
   */
  retry?: {
    maxAttempts?: number; // default: 3
    backoffMs?: number; // default: 1000
    backoffMultiplier?: number; // default: 2
  };
  /**
   * Circuit breaker to prevent cascade failures.
   */
  circuitBreaker?: {
    failureThreshold?: number; // default: 5
    resetTimeoutMs?: number; // default: 30000
  };
  /**
   * Rate limiting per provider.
   */
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  /**
   * Optional shared state to persist circuit breaker / rate limiter across calls.
   */
  state?: {
    circuitBreaker?: {
      isOpen(): boolean;
      recordSuccess(): void;
      recordFailure(): void;
    };
    rateLimiter?: {
      acquire(): Promise<void>;
    };
  };
  /**
   * Request timeout in milliseconds.
   */
  timeoutMs?: number; // default: 30000
  /**
   * Concurrent chunk processing. Default: 1.
   */
  concurrency?: number;
}

// ─────────────────────────────────────────────────────────────
// Main Options Interface
// ─────────────────────────────────────────────────────────────

export interface EmbeddingOptions {
  /**
   * Embedding provider configuration.
   */
  provider: EmbeddingProviderConfig;
  /**
   * Model identifier.
   */
  model?: string;
  /**
   * Input text configuration.
   */
  input?: EmbeddingInputConfig;
  /**
   * Chunking and tokenization settings.
   */
  chunking?: ChunkingConfig;
  /**
   * Output format and aggregation.
   */
  output?: OutputConfig;
  /**
   * Safety and compliance settings.
   */
  safety?: SafetyConfig;
  /**
   * Caching configuration.
   */
  cache?: EmbeddingCacheConfig;
  /**
   * Resilience and rate limiting.
   */
  resilience?: ResilienceConfig;
  /**
   * Callback for each chunk (receives redacted content by default).
   */
  onChunk?: (chunk: Readonly<string>, embedding: Readonly<number[]>) => void;
  /**
   * Metrics callback for observability.
   */
  onMetrics?: (metrics: EmbeddingMetrics) => void;
}

// ─────────────────────────────────────────────────────────────
// Result Types (Discriminated Union for Type Safety)
// ─────────────────────────────────────────────────────────────

export interface EmbeddingSource {
  /** Model used (may be undefined for custom providers) */
  model?: string;
  chunks: number;
  tokens: number;
  checksum: string;
  cached: boolean;
  latencyMs: number;
}

export type EmbeddingResult =
  | {
      status: "success";
      aggregation: "average" | "max" | "first";
      vector: number[];
      source: EmbeddingSource;
    }
  | {
      status: "success";
      aggregation: "all";
      vectors: number[][];
      source: EmbeddingSource;
    }
  | {
      status: "skipped";
      reason: string;
      source: Partial<EmbeddingSource>;
    };

// ─────────────────────────────────────────────────────────────
// Metrics for Observability
// ─────────────────────────────────────────────────────────────

export interface EmbeddingMetrics {
  provider: string;
  /** Model used (may be undefined for custom providers) */
  model?: string;
  inputTokens: number;
  outputDimensions: number;
  chunks: number;
  latencyMs: number;
  cached: boolean;
  retries: number;
  piiRedacted: boolean;
}
```

## Embedding Pipeline

### Input Selection

- `textContent` uses existing `ScrapedData.textContent`.
- `title+summary` uses `title` plus `summary` (if available) or `excerpt` as fallback.
- `custom` allows callers to provide a string via `options.embeddings.input.customText`.

This should produce a cleaned `contentText` used for embedding only, without changing the public `textContent` field.

### Chunking and Aggregation

- Token counting can use a simple heuristic (chars / 4) by default.
- Optional provider-specific tokenizers can be added later.
- Default chunk size of 500 tokens, overlap 50 tokens.
- Aggregation:
  - `average`: average all chunk vectors.
  - `max`: element-wise max.
  - `first`: use first chunk.
  - `all`: return `vectors` only.

### Caching

#### Content-Addressable Cache Strategy

**Critical:** Cache keys must be based on content, not URLs. This ensures:

1. Same content from different URLs shares cached embeddings (deduplication)
2. Changed content at the same URL gets fresh embeddings

**Cache Key Construction:**

```ts
const cacheKey = hash({
  providerKey, // baseUrl/endpoint/model identifiers
  modelName,
  dimensions,
  aggregation,
  chunking, // size, overlap, tokenizer, maxInputLength
  safety, // redaction config + thresholds
  cacheKeySalt, // required for custom providers/transforms
  contentHash, // hash(redactedInputText)
});
```

**Notes:**

- URL is metadata stored with the result, NOT part of the cache key identity.
- Use `cacheKeySalt` for custom providers or input transforms to avoid collisions.

#### Cache Interface

```ts
export interface EmbeddingCache {
  get(key: string): Promise<EmbeddingResult | undefined>;
  set(
    key: string,
    value: EmbeddingResult,
    options?: { ttlMs?: number }
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}
```

#### Cache Validation

On cache retrieval, validate:

- Embedding dimensions match expected model dimensions
- Result schema matches `EmbeddingResult` type
- Checksum integrity (optional encryption verification)

Default: In-memory LRU cache with configurable max entries and TTL.

### Rate Limiting

Add an optional token bucket limiter applied per provider instance. Default: no throttling unless configured.

**State persistence:** Circuit breaker and rate limiter are per call by default. For persistent state across scrapes, pass a shared `resilience.state` object.

## Provider Design

### Interface

```ts
export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[], options: EmbedRequest): Promise<EmbedResponse>;
}

export interface EmbedRequest {
  model?: string;
  dimensions?: number;
  signal?: AbortSignal; // For timeout/cancellation
}

export interface EmbedResponse {
  embeddings: number[][];
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}
```

### Provider Implementations

| Provider                | Use Case                                         | Configuration                      | Network Required      |
| ----------------------- | ------------------------------------------------ | ---------------------------------- | --------------------- |
| Preset factories        | OpenAI, Azure, Ollama, HuggingFace, Cohere, etc. | `createOpenAIEmbedding(...)`       | Yes (or local)        |
| `HttpEmbeddingProvider` | Generic HTTP endpoints                           | `HttpEmbeddingConfig`              | Yes (local or remote) |
| Transformers preset     | **In-process, offline, privacy-first**           | `createTransformersEmbedding(...)` | **No**                |

### HttpEmbeddingProvider (Generic)

Enables any OpenAI-compatible or custom HTTP endpoint:

```ts
const ollamaProvider = createHttpEmbedding({
  baseUrl: "http://localhost:11434/api/embeddings",
  model: "nomic-embed-text",
  requestBuilder: (texts, model) => ({ model, prompt: texts[0] }),
  responseMapper: (res) => [res.embedding],
  requireHttps: false, // Local dev only
});

const huggingfaceProvider = createHttpEmbedding({
  baseUrl:
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
  headers: { Authorization: `Bearer ${HF_TOKEN}` },
  requestBuilder: (texts) => ({ inputs: texts }),
  responseMapper: (res) => res,
});
```

### Transformers Preset (In-Process)

**The privacy-first, zero-cost default.** Runs embedding models directly in Node.js using [Transformers.js](https://huggingface.co/docs/transformers.js).

```ts
import * as transformers from "@huggingface/transformers";
import { createTransformersEmbedding } from "scrapex/embeddings";

const provider = createTransformersEmbedding(transformers, {
  model: "Xenova/all-MiniLM-L6-v2",
  quantized: true,
  pooling: "mean",
  normalize: true,
});
```

#### Recommended Models

| Model                          | Dimensions | Size   | Use Case                            |
| ------------------------------ | ---------- | ------ | ----------------------------------- |
| `Xenova/all-MiniLM-L6-v2`      | 384        | ~23MB  | **Default** - Fast, general purpose |
| `Xenova/all-mpnet-base-v2`     | 768        | ~110MB | Higher quality, more resources      |
| `Xenova/bge-small-en-v1.5`     | 384        | ~33MB  | Optimized for retrieval             |
| `Xenova/multilingual-e5-small` | 384        | ~118MB | Multi-language support              |

#### Resource Considerations

| Factor     | Impact                               | Mitigation                                   |
| ---------- | ------------------------------------ | -------------------------------------------- |
| First load | 2-5s model download + initialization | Cache models, lazy-load pipeline             |
| Memory     | 100-500MB depending on model         | Use quantized models, single instance        |
| CPU        | Inference uses CPU cores             | Batch processing, limit concurrency          |
| Cold start | Subsequent calls are fast (~10-50ms) | Keep pipeline warm in long-running processes |

#### Offline Usage

For fully air-gapped environments, pre-download models:

```bash
# Pre-download model to cache
npx transformers-cli download Xenova/all-MiniLM-L6-v2

# Or specify custom cache directory
TRANSFORMERS_CACHE=/app/models npx transformers-cli download Xenova/all-MiniLM-L6-v2
```

Then configure:

```ts
import * as transformers from '@huggingface/transformers';
import { createTransformersEmbedding } from 'scrapex/embeddings';

embeddings: {
  provider: {
    type: 'custom',
    provider: createTransformersEmbedding(transformers, {
      model: 'Xenova/all-MiniLM-L6-v2',
      cacheDir: '/app/models',
    }),
  },
}
```

**Node.js runtime note:** Install `onnxruntime-node` for native inference:

```bash
npm install onnxruntime-node
```

### Dependency Isolation

**Critical:** Embedding presets are lightweight HTTP wrappers. The only optional dependency is
`@huggingface/transformers`, which is **injected by the caller** for the Transformers preset.

#### Optional Dependencies in package.json

```json
{
  "peerDependencies": {
    "@huggingface/transformers": "^3.0.0",
    "onnxruntime-node": "^1.18.0"
  },
  "peerDependenciesMeta": {
    "@huggingface/transformers": { "optional": true },
    "onnxruntime-node": { "optional": true }
  }
}
```

This avoids runtime errors for users who only need specific providers.

### Security Requirements

1. **HTTPS Enforcement:** All providers default to `requireHttps: true`. Explicit opt-out required for local development.
2. **SSRF Protection:** Validate `baseUrl` and resolved IPs; re-validate after redirects unless explicitly allowed.
3. **Response Validation:** Verify embedding dimensions match expected values; reject malformed responses.
4. **No Raw Content Logging:** Providers must never log input texts or embeddings.

## Operational Behavior

- If `embeddings` is not specified, no embedding work is performed.
- If provider credentials are missing, return `embeddings.source.skipped = true` with `reason`.
- If scrape fails, embeddings are not computed.
- If input text length is below `minTextLength`, skip with reason.
- Embeddings should never throw unless the caller explicitly opts into strict mode (optional).

## Security and Privacy Best Practices

### Data Protection

| Concern                          | Mitigation                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| **PII Leakage to Third Parties** | Apply `piiRedaction` before sending to external APIs. Required for GDPR/CCPA compliance. |
| **Raw Content Logging**          | Never log raw text or embeddings. Use checksums for debugging.                           |
| **Cache Key Exposure**           | Use content hash, not raw text, in cache keys.                                           |
| **Embedding Inversion**          | Embeddings can be partially reversed. Use PII redaction as first line of defense.        |

Default redaction patterns cover email, US phone formats, credit cards, SSN, and IPv4 addresses. Use `customPatterns` for additional coverage.

### Network Security

| Concern                       | Mitigation                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **SSRF via Custom Providers** | Validate `baseUrl`, resolve DNS to block private IPs, and re-validate redirect targets. Require explicit allowlist for internal endpoints. |
| **TLS Enforcement**           | Default `requireHttps: true` for all providers. Explicit opt-out for local development only.                                               |
| **Man-in-the-Middle**         | Enforce TLS 1.2+ for all provider connections.                                                                                             |

### Access Control

| Concern                    | Mitigation                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| **API Key Management**     | Source from env vars by default or explicit `apiKey` string in config.   |
| **Credential Persistence** | Never persist API keys. Clear from memory after provider initialization. |
| **Multi-tenant Isolation** | Support per-tenant rate limits via `rateLimit.scope` parameter.          |

### Resource Protection

| Concern               | Mitigation                                                  |
| --------------------- | ----------------------------------------------------------- |
| **Billing DoS**       | Enforce `maxTokens` caps. Default: 8192 tokens per request. |
| **Memory Exhaustion** | Enforce `maxInputLength` cap. Default: 100KB.               |
| **Rate Abuse**        | Token bucket limiter per provider with configurable limits. |

### Callback Security

| Concern                         | Mitigation                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Sensitive Data in Callbacks** | `onChunk` receives redacted content by default. Require `allowSensitiveCallbacks: true` for raw data. |
| **Callback Type Safety**        | Use `Readonly<string>` and `Readonly<number[]>` to prevent mutation.                                  |

### Compliance Checklist

- [ ] Enable `piiRedaction` when using third-party embedding APIs
- [ ] Use content-addressable caching (no URLs in cache keys)
- [ ] Enforce HTTPS for all production providers
- [ ] Set appropriate `maxTokens` and `maxInputLength` limits
- [ ] Implement audit logging via `onMetrics` callback
- [ ] Review `respectRobots` compliance in scrape options

## Data Flow (High Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                        scrape(url, options)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Fetch + Extract                                              │
│     └─► ContentExtractor produces textContent, content           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. LLM Enhancement (optional)                                   │
│     └─► Produces summary, entities, tags                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Embedding Pipeline (if options.embeddings)                   │
│     ├─► Select input (textContent | title+summary | transform)   │
│     ├─► Apply PII redaction                                      │
│     ├─► Check minTextLength (skip if too short)                  │
│     ├─► Check cache (return if hit)                              │
│     ├─► Chunk text (with overlap)                                │
│     ├─► Embed chunks (with retry/circuit breaker)                │
│     ├─► Aggregate vectors (average | max | first | all)          │
│     ├─► Cache result                                             │
│     └─► Emit metrics                                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Return ScrapedData with embeddings                           │
└─────────────────────────────────────────────────────────────────┘
```

## Example Usage

### Basic Usage with OpenAI

```ts
import { createOpenAIEmbedding } from "scrapex/embeddings";

const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "custom",
      provider: createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
    },
    model: "text-embedding-3-small",
    output: { aggregation: "average" },
  },
});

if (result.embeddings?.status === "success") {
  console.log("Embedding vector:", result.embeddings.vector);
}
```

### With PII Redaction (GDPR/CCPA Compliant)

```ts
import { createOpenAIEmbedding } from "scrapex/embeddings";

const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "custom",
      provider: createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
    },
    model: "text-embedding-3-small",
    safety: {
      piiRedaction: {
        email: true,
        phone: true,
        creditCard: true,
      },
      maxTokens: 4096,
    },
  },
});
```

### Custom Input Transform

```ts
import { createOpenAIEmbedding } from "scrapex/embeddings";

const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "custom",
      provider: createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
    },
    model: "text-embedding-3-small",
    input: {
      // Combine extracted fields dynamically
      transform: (data) =>
        `${data.title}\n\n${data.excerpt}\n\nPrice: ${data.price}`,
    },
  },
});
```

### With Transformers.js (In-Process, Offline)

**Zero API costs, fully offline, data never leaves the server:**

```ts
// Install: npm install @huggingface/transformers onnxruntime-node
import * as transformers from "@huggingface/transformers";
import { createTransformersEmbedding } from "scrapex/embeddings";

const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "custom",
      provider: createTransformersEmbedding(transformers),
    },
  },
});

// Or with custom model
const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "custom",
      provider: createTransformersEmbedding(transformers, {
        model: "Xenova/bge-small-en-v1.5",
        quantized: true,
        pooling: "mean",
        normalize: true,
      }),
    },
  },
});
```

### With Ollama (Local Server)

```ts
import { createOpenAIEmbedding } from "scrapex/embeddings";

const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "http",
      config: {
        baseUrl: "http://localhost:11434/api/embeddings",
        model: "nomic-embed-text",
        requestBuilder: (texts, model) => ({ model, prompt: texts[0] }),
        responseMapper: (res) => [res.embedding],
        requireHttps: false, // Local dev only
      },
    },
  },
});
```

### With Resilience Options

```ts
import { createOpenAIEmbedding } from "scrapex/embeddings";

const result = await scrape(url, {
  embeddings: {
    provider: {
      type: "custom",
      provider: createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
    },
    model: "text-embedding-3-small",
    resilience: {
      retry: { maxAttempts: 3, backoffMs: 1000 },
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000 },
      rateLimit: { requestsPerMinute: 60 },
      timeoutMs: 30000,
    },
    onMetrics: (metrics) => {
      console.log(
        `Embedded in ${metrics.latencyMs}ms, ${metrics.chunks} chunks`
      );
    },
  },
});
```

## Standalone Embedding Function

For use cases outside of `scrape()`, export a standalone `embed()` function:

```ts
import {
  embed,
  embedScrapedData,
  createOpenAIEmbedding,
} from "scrapex/embeddings";

// Embed arbitrary text
const result = await embed("This is the text to embed", {
  provider: {
    type: "custom",
    provider: createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
  },
  model: "text-embedding-3-small",
});

// Embed from ScrapedData (uses existing textContent)
const scraped = await scrape(url);
const embeddingResult = await embedScrapedData(scraped, {
  provider: {
    type: "custom",
    provider: createOpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
  },
  model: "text-embedding-3-small",
  input: { type: "title+summary" },
});
```

### Function Signatures

```ts
/**
 * Embed arbitrary text.
 */
export async function embed(
  text: string,
  options: EmbeddingOptions
): Promise<EmbeddingResult>;

/**
 * Embed from ScrapedData using configured input selection.
 */
export async function embedScrapedData(
  data: ScrapedData,
  options: EmbeddingOptions
): Promise<EmbeddingResult>;
```

## Acceptance Criteria

## Implementation Status (Current)

| Area                    | Status          | Notes                                                                           |
| ----------------------- | --------------- | ------------------------------------------------------------------------------- |
| Core types and pipeline | Implemented     | `EmbeddingOptions`, `EmbeddingResult`, pipeline in `src/embeddings/pipeline.ts` |
| Provider config         | Implemented     | `http` + `custom` only                                                          |
| Preset factories        | Implemented     | OpenAI, Azure, Ollama, HuggingFace, Cohere, Transformers                        |
| Transformers support    | Implemented     | Dependency injection via `createTransformersEmbedding()`                        |
| PII redaction           | Implemented     | Regex-based patterns in `src/embeddings/safety.ts`                              |
| Chunking + aggregation  | Implemented     | Size/overlap, `average`/`max`/`first`/`all`                                     |
| Cache                   | Implemented     | Content-addressable keys + optional salt                                        |
| Resilience              | Implemented     | Retry, timeout, circuit breaker, rate limiting, concurrency                     |
| Cleaning profiles       | Not implemented | Out of scope for current release                                                |

### Core Functionality

- [x] `ScrapeOptions` includes `embeddings` option
- [x] `ScrapedData` includes optional `embeddings` result
- [x] Embeddings computed only when explicitly enabled
- [x] Skips gracefully when missing keys, short content, or errors
- [x] Discriminated union result type (`success` | `skipped`)

### Provider Support

- [x] Preset factories (OpenAI, Azure, Ollama, HuggingFace, Cohere, etc.)
- [x] `HttpEmbeddingProvider` for generic HTTP APIs
- [x] Transformers preset via dependency injection
- [x] Provider-agnostic design (no hard dependency on provider packages)
- [x] HTTPS enforcement with explicit opt-out

### Input Processing

- [x] Input selection: `textContent`, `title+summary`, `transform` function
- [x] PII redaction: email, phone, creditCard, SSN, IP, custom patterns
- [x] Pluggable tokenizer: `heuristic`, `tiktoken`, custom function

### Chunking & Aggregation

- [x] Configurable chunk size and overlap
- [x] Aggregation modes: `average`, `max`, `first`, `all`
- [x] Strict vector/vectors behavior based on aggregation mode

### Caching

- [x] Content-addressable cache (URL not in key)
- [x] Cache validation on retrieval
- [x] TTL and max entries configuration

### Resilience

- [x] Retry with exponential backoff
- [x] Circuit breaker for cascade failure prevention
- [x] Rate limiting (requests/tokens per minute)
- [x] Request timeout configuration
- [x] Concurrent chunk processing

### Security

- [x] No raw content logging
- [x] SSRF protection for custom base URLs
- [x] Callback receives redacted content by default
- [x] `maxTokens` and `maxInputLength` caps

### Observability

- [x] `onMetrics` callback with latency, tokens, chunks
- [x] `onChunk` callback for progress tracking

### Standalone Functions

- [x] `embed(text, options)` for arbitrary text
- [x] `embedScrapedData(data, options)` for ScrapedData

### Documentation

- [x] README section with usage examples
- [x] Security best practices documentation
- [x] Provider configuration examples

## Implementation Plan

### Phase 1: Types & Core Infrastructure

**Files:** `src/embeddings/types.ts`, `src/core/types.ts`

| Task                    | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| Define types            | `EmbeddingOptions`, `EmbeddingResult`, `EmbeddingProvider`, `EmbeddingCache` |
| Extend core types       | Add `embeddings?` to `ScrapeOptions` and `ScrapedData`                       |
| Export types            | Update `src/index.ts` with new exports                                       |
| PII redaction utilities | Regex patterns for email, phone, creditCard, SSN, IP                         |

### Phase 2: Embedding Core

**Files:** `src/embeddings/pipeline.ts`, `src/embeddings/input.ts`, `src/embeddings/chunking.ts`, `src/embeddings/aggregation.ts`, `src/embeddings/cache.ts`, `src/embeddings/safety.ts`

| Task            | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| Input selection | `textContent`, `title+summary`, `transform` function support     |
| PII redaction   | Apply configured patterns before embedding                       |
| Tokenizer       | `heuristic` (chars/4), `tiktoken` (lazy-loaded), custom function |
| Chunking        | Configurable size, overlap, maxInputLength enforcement           |
| Aggregation     | `average`, `max`, `first`, `all` implementations                 |
| Cache           | Content-addressable keys, TTL, validation, encryption option     |

### Phase 3: Provider Layer

**Files:** `src/embeddings/providers/*.ts`

| Task                    | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| Provider interface      | `EmbeddingProvider` with `embed()` method                        |
| Preset factories        | OpenAI, Azure, Ollama, HuggingFace, Cohere, etc.                 |
| HTTP provider           | Generic with request/response mappers                            |
| **Transformers preset** | **In-process with `@huggingface/transformers`, offline support** |
| Security                | HTTPS enforcement, SSRF protection, response validation          |

### Phase 4: Resilience

**Files:** `src/common/resilience.ts`, `src/embeddings/resilience.ts`

| Task            | Description                                    |
| --------------- | ---------------------------------------------- |
| Retry logic     | Exponential backoff with configurable attempts |
| Circuit breaker | Failure threshold, reset timeout               |
| Rate limiting   | Token bucket per provider                      |
| Timeout         | AbortController integration                    |
| Concurrency     | Parallel chunk processing                      |

### Phase 5: Integration

**Files:** `src/core/scrape.ts`, `src/embeddings/index.ts`

| Task                 | Description                                           |
| -------------------- | ----------------------------------------------------- |
| Pipeline integration | Wire into `scrape()` after LLM enhancement            |
| Skip behavior        | Handle missing keys, short content, errors gracefully |
| Standalone functions | `embed()`, `embedScrapedData()` exports               |
| Metrics              | `onMetrics` callback implementation                   |

### Phase 6: Documentation

**Files:** `README.md`, `docs/embeddings.md`

| Task           | Description                                    |
| -------------- | ---------------------------------------------- |
| Usage examples | Basic, PII redaction, custom transform, Ollama |
| Security guide | SSRF, PII, caching, compliance checklist       |
| Provider setup | OpenAI, Azure, Ollama, HuggingFace examples    |

---

## Test Plan

### Unit Tests: Core

| Test Case           | Description                                            |
| ------------------- | ------------------------------------------------------ |
| Input selection     | `textContent`, `title+summary`, `transform` function   |
| PII redaction       | Email, phone, creditCard patterns correctly redacted   |
| Tokenizer accuracy  | Heuristic vs tiktoken comparison                       |
| Chunking boundaries | Correct chunk count, overlap preserved                 |
| Aggregation math    | Average, max, first produce correct vectors            |
| Cache key stability | Same input → same key; different input → different key |

### Unit Tests: Skip Behavior

| Test Case             | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| Missing API key       | Returns `{ status: 'skipped', reason: 'Missing API key' }`             |
| Short content         | Returns `{ status: 'skipped', reason: 'Content below minTextLength' }` |
| Provider error        | Returns skipped, scrape still succeeds                                 |
| Input length exceeded | Returns skipped with `maxInputLength` reason                           |

### Unit Tests: Security

| Test Case           | Description                                    |
| ------------------- | ---------------------------------------------- |
| SSRF protection     | Private IPs rejected for `baseUrl`             |
| HTTPS enforcement   | HTTP rejected unless `requireHttps: false`     |
| Callback redaction  | `onChunk` receives redacted content by default |
| Response validation | Malformed embeddings rejected                  |

### Unit Tests: Resilience

| Test Case              | Description                              |
| ---------------------- | ---------------------------------------- |
| Retry success          | Transient failure recovered after retry  |
| Retry exhausted        | Max attempts reached, returns error      |
| Circuit breaker opens  | Threshold failures trigger open state    |
| Circuit breaker resets | Reset after timeout period               |
| Rate limiting          | Requests delayed when limit exceeded     |
| Timeout                | Request aborted after configured timeout |

### Integration Tests

| Test Case                       | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| `scrapeHtml()` with embeddings  | Mock provider, verify result structure          |
| `scrape()` flow ordering        | Extractors → LLM → Embeddings sequence          |
| `textContent` unchanged         | Embedding uses cleaned copy, original preserved |
| Cache hit                       | Second request returns cached result            |
| Standalone `embed()`            | Arbitrary text embedding works                  |
| Standalone `embedScrapedData()` | ScrapedData embedding works                     |
| Ollama provider                 | `HttpEmbeddingProvider` with local endpoint     |
| HuggingFace provider            | Custom request/response mappers                 |
| Transformers provider           | In-process embedding with default model         |
| Transformers custom model       | Non-default model configuration                 |
| Transformers offline mode       | Pre-cached model without network                |

### Performance Tests

| Test Case               | Description                           |
| ----------------------- | ------------------------------------- |
| Large document chunking | 100KB document chunked correctly      |
| Concurrent processing   | Multiple chunks processed in parallel |
| Cache performance       | LRU eviction under memory pressure    |

---

## Summary of Improvements

This proposal incorporates feedback from solution architecture and security reviews.

### Key Changes from Original Proposal

| Area                  | Original                                   | Improved                                                                      |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| **Provider Design**   | Hardcoded `'openai' \| 'azure' \| 'local'` | Extensible `EmbeddingProviderConfig` with `HttpEmbeddingProvider` for any API |
| **Result Types**      | Ambiguous `vector?` and `vectors?`         | Discriminated union with `status: 'success' \| 'skipped'`                     |
| **Cache Keys**        | URL-based                                  | Content-addressable (hash of content, not URL)                                |
| **PII Handling**      | Not addressed                              | `piiRedaction` config with email, phone, creditCard, SSN, IP patterns         |
| **Input Selection**   | Static `'custom'` string                   | `transform: (data) => string` function for dynamic construction               |
| **Tokenizer**         | Only `chars / 4` heuristic                 | Pluggable: `'heuristic' \| 'tiktoken' \| function`                            |
| **Resilience**        | Only rate limiting                         | Retry, circuit breaker, timeout, concurrency                                  |
| **Callback Security** | Documentation only                         | `allowSensitiveCallbacks` opt-in, `Readonly` types                            |
| **Provider Security** | Not addressed                              | HTTPS enforcement, SSRF protection, response validation                       |
| **Observability**     | Not addressed                              | `onMetrics` callback with latency, tokens, cached status                      |
| **Standalone API**    | Coupled to `scrape()`                      | `embed()` and `embedScrapedData()` functions                                  |

### Security Enhancements

1. **GDPR/CCPA Compliance:** PII redaction before sending to third-party APIs
2. **SSRF Protection:** Private IP validation for custom provider URLs
3. **TLS Enforcement:** HTTPS required by default for all providers
4. **Billing DoS Prevention:** `maxTokens` and `maxInputLength` caps
5. **Callback Isolation:** Redacted content by default in callbacks
6. **Cache Security:** Content-addressable keys, optional encryption at rest

### Enterprise Readiness

1. **Provider Agnostic:** Works with OpenAI, Azure, Ollama, HuggingFace, Transformers.js, custom APIs
2. **Offline/Air-gapped Support:** Transformers preset runs fully in-process
3. **Dependency Isolation:** Transformers is optional and injected by the caller
4. **Resilience Patterns:** Retry, circuit breaker, rate limiting built-in
5. **Observability:** Metrics callback for monitoring and alerting
6. **Multi-tenant Support:** Per-scope rate limiting capability

### Provider Comparison

| Provider         | Network      | Cost      | Latency    | Privacy               | Best For                               |
| ---------------- | ------------ | --------- | ---------- | --------------------- | -------------------------------------- |
| OpenAI           | Required     | Per-token | Low        | Data sent to API      | Production, high quality               |
| Azure            | Required     | Per-token | Low        | Enterprise compliance | Enterprise, data residency             |
| Ollama           | Local only   | Free      | Low        | Data stays local      | Development, self-hosted               |
| **Transformers** | **None**     | **Free**  | **Medium** | **Maximum**           | **Offline, privacy-first, air-gapped** |
| HTTP             | Configurable | Varies    | Varies     | Configurable          | Custom backends                        |
