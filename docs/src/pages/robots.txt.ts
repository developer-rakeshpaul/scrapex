import type { APIRoute } from 'astro';

const bots = [
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'CCBot',
  'ClaudeBot',
  'Google-Extended',
  'GPTBot',
  'meta-externalagent',
];

const getRobotsTxt = (sitemapURL: URL) => `User-agent: *
Allow: /

${bots.map((bot) => `User-agent: ${bot}\nDisallow: /`).join('\n\n')}

Sitemap: ${sitemapURL.href}`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL('sitemap-index.xml', site);
  return new Response(getRobotsTxt(sitemapURL));
};
