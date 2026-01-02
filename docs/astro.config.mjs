import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://scrapex.binaryroute.com',
  integrations: [
    starlight({
      title: 'scrapex',
      description: 'Modern web scraper with LLM-enhanced extraction',
      head: [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
        { tag: 'link', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'scrapex' } },
        { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
      ],
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
            { label: 'RSS/Atom Parsing', slug: 'guides/rss-parsing' },
            { label: 'LLM Integration', slug: 'guides/llm-integration' },
            { label: 'Embeddings', slug: 'guides/embeddings' },
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
            { label: 'Embeddings', slug: 'api/embeddings' },
            { label: 'Parsers', slug: 'api/parsers' },
            { label: 'Utilities', slug: 'api/utilities' },
            { label: 'Types', slug: 'api/types' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      expressiveCode: {
        themes: ['catppuccin-mocha', 'catppuccin-latte'],
      },
    }),
  ],
});
