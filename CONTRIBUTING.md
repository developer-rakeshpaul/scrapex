# Contributing to scrapex

Thank you for your interest in contributing to scrapex! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check the [existing issues](https://github.com/developer-rakeshpaul/scrapex/issues) to avoid duplicates
2. Use the latest version of scrapex
3. Collect relevant information (Node.js version, OS, error messages)

When submitting a bug report:

- Use a clear, descriptive title
- Describe the steps to reproduce the issue
- Include expected vs actual behavior
- Add code samples or error logs if applicable

### Suggesting Features

Feature requests are welcome! Please:

1. Check existing issues and discussions first
2. Describe the problem your feature would solve
3. Explain your proposed solution
4. Consider alternative approaches

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following the code style guidelines
4. **Add tests** for new functionality
5. **Run the test suite**: `npm test`
6. **Run type checking**: `npm run type-check`
7. **Run linting**: `npm run lint`
8. **Commit your changes** with a descriptive message
9. **Push to your fork** and submit a pull request

#### Commit Message Format

We use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(rss): add Media RSS namespace support`
- `fix(normalizer): handle empty content blocks`
- `docs: update API reference`

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/scrapex.git
cd scrapex

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run type-check

# Lint and format
npm run lint
npm run format

# Build
npm run build
```

### Code Style

- We use [Biome](https://biomejs.dev/) for linting and formatting
- TypeScript strict mode is enabled
- Write tests for new features
- Add JSDoc comments for public APIs
- Keep functions focused and small

### Testing

- Unit tests are in `test/` directory
- E2E tests are in `test/e2e/`
- Run all tests: `npm test`
- Run specific test: `npm test -- path/to/test.ts`

### Pre-commit Hooks

We use [Lefthook](https://github.com/evilmartians/lefthook) for git hooks:

- **pre-commit**: Runs Biome lint/format on staged files
- **pre-push**: Runs type-check and full test suite

These are installed automatically via `npm install`.

## Project Structure

```
scrapex/
├── src/
│   ├── content/      # Content normalization
│   ├── core/         # Core scraping logic
│   ├── embeddings/   # Vector embeddings
│   ├── extractors/   # Content extractors
│   ├── fetchers/     # HTTP fetching
│   ├── llm/          # LLM integration
│   ├── parsers/      # RSS, Markdown parsers
│   └── utils/        # URL and feed utilities
├── test/             # Test files
├── docs/             # Documentation site
└── examples/         # Usage examples
```

## Getting Help

- Check the [documentation](https://scrapex.dev)
- Search [existing issues](https://github.com/developer-rakeshpaul/scrapex/issues)
- Open a [new issue](https://github.com/developer-rakeshpaul/scrapex/issues/new/choose)
- Start a [discussion](https://github.com/developer-rakeshpaul/scrapex/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
