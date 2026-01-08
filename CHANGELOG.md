# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-08

First stable release of scrapex.

### Added

- **Content Normalization** - Clean, embedding-ready text with boilerplate removal
  - `normalize` option in `scrape()` for integrated normalization
  - `parseBlocks()`, `normalizeText()` for standalone use
  - `defaultBlockClassifier` and `combineClassifiers()` for custom filtering
  - Block types: paragraph, heading, list, quote, table, code, media, nav, footer, promo, legal
  - Truncation strategies: sentence, word, char
  - SHA-256 content hashing for deduplication

- **Feed Item Normalization** - `normalizeFeedItem()` helper for RSS/Atom content
  - Converts feed item content to clean, embedding-ready text
  - Falls back to plain text extraction when HTML parsing yields no blocks

- **Media RSS Support** - Enhanced podcast and media feed handling
  - `selector@attr` syntax for extracting XML attributes (e.g., `media:thumbnail@url`)
  - Support for iTunes, Media RSS, and other namespaced elements

- **Vector Embeddings** - Generate embeddings from scraped content
  - Providers: OpenAI, Azure, Cohere, HuggingFace, Ollama, Transformers.js
  - PII redaction (email, phone, SSN, credit card, IP)
  - Smart chunking with configurable size/overlap
  - Aggregation modes: average, max, first, all
  - Content-addressable caching
  - Resilience: retry, circuit breaker, rate limiting
  - SSRF protection for custom endpoints

- **RSS/Atom Feed Parsing** - Comprehensive feed support
  - RSS 2.0, RSS 1.0 (RDF), and Atom 1.0 formats
  - `fetchFeed()` for fetch + parse in one call
  - `paginateFeed()` for RFC 5005 pagination
  - `discoverFeeds()` to find feeds in HTML
  - `filterByDate()`, `feedToMarkdown()`, `feedToText()` utilities
  - Custom field extraction with namespace support

- **LLM Integration** - Provider-agnostic content enhancement
  - Preset factories: `createOpenAI()`, `createAnthropic()`, `createOllama()`, `createLMStudio()`
  - Enhancements: summarize, tags, entities, classify
  - Schema-driven structured extraction

- **Core Scraping** - Fetch and extract web content
  - `scrape(url, options)` and `scrapeHtml(html, url, options)`
  - LLM-optimized output (Markdown content, plain text)
  - Robots.txt support via `respectRobots` option

- **Built-in Extractors** - Priority-based extraction pipeline
  - MetaExtractor (Open Graph, Twitter Cards)
  - JsonLdExtractor (structured data)
  - FaviconExtractor
  - ContentExtractor (Readability + Turndown)
  - LinksExtractor

- **Parsers** - Content parsing utilities
  - MarkdownParser with frontmatter support
  - GitHub URL helpers (isGitHubRepo, parseGitHubUrl, toRawUrl)

- **URL Utilities** - Common URL operations
  - normalizeUrl, resolveUrl, extractDomain
  - isValidUrl, isExternalUrl, matchesUrlPattern

- **Security Features**
  - HTTPS-only URL resolution in feeds
  - XML mode parsing for RSS/Atom feeds (prevents XXE/XSS vectors in feed parsing)
  - ReDoS prevention via input limiting
  - maxBlocks enforcement (default 2000)

### Changed

- LLM providers refactored to use shared `HttpLLMProvider` base
- LLM enhancements run before embeddings for better downstream inputs
- Embeddings pipeline prefers `normalizedText` when available
- Safer merge behavior prevents undefined values from overwriting results

### Removed

- Direct `OpenAIProvider` and `AnthropicProvider` classes (use factory functions)

### Fixed

- Packaging: ensure `scrapex/embeddings` is properly exported
- Restore `createTransformersEmbedding`, `EmbeddingProvider`, `embed` imports
- Duplicate list content in block parsing
- Classifier ordering for media-credit detection

## [1.0.0-beta.5] - 2025-01-08

### Added

- `normalizeFeedItem()` helper for feed item normalization
- `selector@attr` syntax in customFields for XML attribute extraction
- Media RSS namespace support

### Fixed

- Fallback to plain text when HTML parsing yields no blocks

## [1.0.0-beta.4] - 2025-01-07

### Added

- Content normalization (`normalize` option in scrape)
- Block-based content classification
- Custom classifier support via `combineClassifiers()`
- `parseBlocks()` and `normalizeText()` standalone functions
- New types: ContentBlock, BlockType, ClassifierResult, NormalizationMeta

### Security

- ReDoS prevention via input limiting
- maxBlocks enforcement
- SHA-256 content hashing

## [1.0.0-beta.3] - 2025-01-06

### Changed

- LLM enhancements now run before embeddings
- Safer merge logic filters undefined values

### Added

- Expanded E2E test coverage
- Realistic HTML/RSS fixtures

## [1.0.0-beta.2] - 2025-01-05

### Fixed

- Ensure `scrapex/embeddings` is emitted in build
- Restore embedding-related imports

## [1.0.0-beta.1] - 2025-01-04

### Added

- Vector embeddings with multiple providers
- RSS/Atom feed parsing
- Feed utilities (discover, filter, convert)
- Shared HTTP infrastructure for LLM providers

### Changed

- LLM providers use factory functions instead of classes

## [1.0.0-alpha.1] - 2025-01-01

### Added

- Initial release
- Core scraping API
- Built-in extractors
- LLM integration
- Markdown parsing
- URL utilities

[1.0.0]: https://github.com/developer-rakeshpaul/scrapex/compare/v1.0.0-beta.5...v1.0.0
[1.0.0-beta.5]: https://github.com/developer-rakeshpaul/scrapex/compare/v1.0.0-beta.4...v1.0.0-beta.5
[1.0.0-beta.4]: https://github.com/developer-rakeshpaul/scrapex/compare/v1.0.0-beta.3...v1.0.0-beta.4
[1.0.0-beta.3]: https://github.com/developer-rakeshpaul/scrapex/compare/v1.0.0-beta.2...v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/developer-rakeshpaul/scrapex/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/developer-rakeshpaul/scrapex/compare/v1.0.0-alpha.1...v1.0.0-beta.1
[1.0.0-alpha.1]: https://github.com/developer-rakeshpaul/scrapex/releases/tag/v1.0.0-alpha.1
