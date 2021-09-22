import { Readability } from '@mozilla/readability';
import cheerio from 'cheerio';
import { createWindow } from 'domino';
import { JSDOM } from 'jsdom';
import get from 'lodash.get';
import uniq from 'lodash.uniq';
import metascraper, { Metadata } from 'metascraper';

import { getMetadata } from 'page-metadata-parser';
import robotsParser from 'robots-parser';
import sanitize, { IOptions as SanitizeHtmlOptions } from 'sanitize-html';
import { isUri } from 'valid-url';
import HttpAgent from 'agentkeepalive';
import got from 'got';

const { HttpsAgent } = HttpAgent;

const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36';

const TWITTER_META_TAGS = ['site', 'creator', 'description', 'title', 'image'];

export interface ILink {
  text?: string;
  href?: string;
}

export interface IMetadata {
  url: string;
  date?: string;
  image?: string;
  publisher?: string;
  title?: string;
  author?: string;
  description?: string;
  audio?: string;
  logo?: string;
  lang?: string;
  text?: string;
  favicon?: string;
  tags: Array<string>;
  keywords: Array<string>;
  links?: ILink[];
  content?: string;
  html?: string;
  source: string;
  video?: string;
  code?: string[];
  embeds?: Array<Record<string, string | undefined>>;
  twitter: Record<string, string | undefined>;
}

function extractTwitterMeta($: cheerio.Root) {
  const tags: Record<string, string | undefined> = {};
  TWITTER_META_TAGS.map((tag: string) => {
    tags[`${tag}`] =
      $(`meta[name='twitter:${tag}']`).attr('content') ||
      $(`meta[property='twitter:${tag}']`).attr('content');
  });
  return tags;
}

export function getEmbedAttrs(el: cheerio.TagElement) {
  return {
    src: el.attribs['src'],
    height: el.attribs['height'],
    width: el.attribs['width'],
    title: el.attribs['title'],
  };
}

function extractEmbeds(
  $: cheerio.Root
): Array<Record<string, string | undefined>> {
  const embeds: Array<Record<string, string | undefined>> = [];

  $('iframe, video, embed').each((_, el: cheerio.Element) => {
    embeds.push(getEmbedAttrs(el as cheerio.TagElement));
  });

  return embeds;
}

function extractCodeSnippets($: cheerio.Root): string[] {
  const code: string[] = [];
  const codeBlocks = $('pre code');
  codeBlocks.each((_, el: cheerio.Element) => {
    code.push($(el).text());
  });
  return code;
}

async function robotsAllowed(prefixUrl: string) {
  const robotsUrl = new URL('/robots.txt', prefixUrl);
  const site = await got('robots.txt', {
    throwHttpErrors: false,
    prefixUrl,
    agent: {
      http: new HttpAgent(),
      https: new HttpsAgent(),
    },
    timeout: 10 * 1000, // 10s request timeout
  });
  const robots = robotsParser(robotsUrl, site.body);
  return robots.isAllowed(prefixUrl, userAgent);
}

const defaultRules = [
  'author',
  'clearbit',
  'date',
  'description',
  'image',
  'lang',
  'logo-favicon',
  'publisher',
  'readability',
  'title',
  'url',
];

type MetaScraperRules =
  | 'audio'
  | 'amazon'
  | 'iframe'
  | 'media-provider'
  | 'soundcloud'
  | 'uol'
  | 'spotify'
  | 'video'
  | 'youtube';

type PageMetaData = {
  description: string;
  icon: string;
  image: string;
  keywords: Array<string>;
  title: string;
  language: string;
  type: string;
  url: string;
  provider: string;
};

export type ScrapeOptions = {
  timeout?: number;
  metascraperRules?: Array<MetaScraperRules>;
  sanitizeOptions?: SanitizeHtmlOptions;
};

const defaultSanitizeOptions = {
  allowedTags: [
    'article',
    'header',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hgroup',
    'main',
    'section',
    'blockquote',
    'dd',
    'div',
    'dl',
    'dt',
    'figcaption',
    'figure',
    'hr',
    'li',
    'main',
    'ol',
    'p',
    'pre',
    'ul',
    'a',
    'abbr',
    'b',
    'br',
    'cite',
    'code',
    'data',
    'dfn',
    'em',
    'i',
    'mark',
    'q',
    's',
    'samp',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'time',
    'u',
    'var',
    'wbr',
    'caption',
    'col',
    'colgroup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'img',
  ],
};

const defaultOptions = {
  metascraperRules: [],
  timeout: 60,
  sanitizeOptions: defaultSanitizeOptions,
};

async function parseMetadata(
  url: string,
  html: string,
  options?: ScrapeOptions
) {
  const parsedUrl = new URL(url);
  const { metascraperRules, sanitizeOptions } = options
    ? { ...defaultOptions, ...options }
    : defaultOptions;

  const rules = [...defaultRules, ...metascraperRules].map((rule: string) =>
    require(`metascraper-${rule}`)()
  );
  const scraper = metascraper(rules);

  const $: cheerio.Root = cheerio.load(html);

  const metadata: Metadata = await scraper({ html, url });
  // console.log([...rules], metadata)
  const doc = createWindow(html).document;
  const data: PageMetaData = getMetadata(doc, url);
  const jsdom = new JSDOM(html, {
    url,
  });
  const article = new Readability(jsdom.window.document).parse();

  const content = sanitize(article?.content || '', sanitizeOptions)
    .replace(/(\r\n|\n|\r)/gm, '')
    .trim();

  const links: Array<ILink> = [];

  cheerio
    .load(content)('a')
    .each(function (_, link) {
      links.push({
        href: $(link).attr('href'),
        text: $(link).text(),
      });
    });
  const tags: Array<string> = [];
  $(
    "a[href*='/t/'],a[href*='/tag/'], a[href*='/tags/'], a[href*='/topic/'],a[href*='/tagged/'], a[href*='?keyword=']"
  ).each(function (_, link) {
    tags.push($(link).text());
  });
  const embeds = extractEmbeds($);

  const code = extractCodeSnippets($);
  const title = get(metadata, 'title') || article?.title;
  // console.dir({ defaultRules, rules });

  const text = sanitize(content || '', {
    allowedTags: [],
    allowedAttributes: {},
  });

  return {
    html,
    content,
    ...metadata,
    author: get(metadata, 'author') || article?.byline,
    favicon: get(data, 'icon'),
    publisher: get(metadata, 'publisher') || article?.siteName || data.provider,
    description:
      get(metadata, 'description') || article?.excerpt || data.description,
    lang: get(metadata, 'lang') || get(data, 'lang'),
    url: get(data, 'url') || get(metadata, 'url'),
    text,
    embeds,
    code,
    tags: uniq(tags),
    source: parsedUrl.hostname,
    twitter: extractTwitterMeta($),
    title,
    links,
    keywords: get(data, 'keywords', []),
  };
}

export const scrape = async (
  url: string,
  options?: ScrapeOptions
): Promise<IMetadata | null> => {
  const { timeout } = options
    ? { ...defaultOptions, ...options }
    : defaultOptions;
  const valid = isUri(url);

  if (!valid) throw new Error('Invalid URL');
  if (valid) {
    const isAllowed = await robotsAllowed(url);

    if (isAllowed) {
      const { body: html } = await await got(url, {
        headers: {
          'User-Agent': userAgent,
        },
        agent: {
          http: new HttpAgent(),
          https: new HttpsAgent(),
        },
        timeout: timeout * 1000, // 10s request timeout
      });

      return await parseMetadata(url, html, options);
    } else {
      throw new Error('Robots.txt disallowed');
    }
  }
  return null;
};

export const scrapeHtml = async (
  url: string,
  html: string,
  options?: ScrapeOptions
): Promise<IMetadata | null> => {
  const valid = isUri(url);

  if (!valid) throw new Error('Invalid URL');
  if (valid) {
    const metadata = await parseMetadata(
      url,
      html,
      options ? { ...defaultOptions, ...options } : defaultOptions
    );
    return metadata;
  }
  return null;
};
