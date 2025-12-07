import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://developer-rakeshpaul.github.io/scrapex',
  base: '/scrapex',
  integrations: [
    starlight({
      title: 'scrapex',
      description: 'Modern web scraper with LLM-enhanced extraction',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      social: {
        github: 'https://github.com/developer-rakeshpaul/scrapex',
      },
      editLink: {
        baseUrl: 'https://github.com/developer-rakeshpaul/scrapex/edit/main/docs/',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Basic Scraping', slug: 'guides/basic-scraping' },
            { label: 'LLM Integration', slug: 'guides/llm-integration' },
            { label: 'Custom Extractors', slug: 'guides/custom-extractors' },
            { label: 'Markdown Parsing', slug: 'guides/markdown-parsing' },
            { label: 'Error Handling', slug: 'guides/error-handling' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'scrape()', slug: 'api/scrape' },
            { label: 'scrapeHtml()', slug: 'api/scrape-html' },
            { label: 'Extractors', slug: 'api/extractors' },
            { label: 'LLM Providers', slug: 'api/llm-providers' },
            { label: 'Parsers', slug: 'api/parsers' },
            { label: 'Utilities', slug: 'api/utilities' },
            { label: 'Types', slug: 'api/types' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
