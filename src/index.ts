import cheerio from 'cheerio';
import { createWindow } from 'domino';
import { convert } from 'html-to-text';
import {
  extractCodeSnippets,
  extractEmbeds,
  extractTwitterMeta,
  getHTML,
  getReadability,
} from './lib';
import get from 'lodash.get';
import uniq from 'lodash.uniq';
import metascraper, { Metadata } from 'metascraper';
import { getMetadata, IPageMetadata } from 'page-metadata-parser';
import sanitize from 'sanitize-html';
import { isUri } from 'valid-url';
import { ILink, IMetadata, ScrapeOptions } from './types';

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

async function getMetascraperMetadata(
  url: string,
  timeout: number = 60,
  scraperRules: Array<string> = defaultRules
) {
  const html = await getHTML(url, timeout);
  if (!html) return null;

  const rules = scraperRules.map((rule: string) =>
    require(`metascraper-${rule}`)()
  );
  const scraper = metascraper(rules);
  const metadata: Metadata = await scraper({ html, url });
  return metadata;
}
async function parseMetadata(
  url: string,
  html: string,
  options?: ScrapeOptions
) {
  const parsedUrl = new URL(url);
  const { metascraperRules, sanitizeOptions, timeout } = options
    ? { ...defaultOptions, ...options }
    : defaultOptions;

  const metadata: Metadata | null = await getMetascraperMetadata(
    url,
    timeout,
    metascraperRules
  );
  // console.log([...rules], metadata)
  const $: cheerio.Root = cheerio.load(html);
  const doc = createWindow(html).document;
  const data: IPageMetadata = getMetadata(doc, url);
  const article = getReadability(url, html);

  const content = sanitize(article?.content || '', sanitizeOptions)
    // .replace(/(\r\n|\n|\r)/gm, '')
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

  const text = convert(content, {
    hideLinkHrefIfSameAsText: true,
    uppercaseHeadings: false,
    ignoreHref: true,
    ignoreImage: true,
  });

  // const text = convert(article?.content || '');

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
    url,
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

export const getMSMetadata = async (url: string, timeout: number = 60) => {
  const metadata = await getMetascraperMetadata(url, timeout);
  return metadata;
};

export const scrape = async (
  url: string,
  options?: ScrapeOptions
): Promise<IMetadata> => {
  const { timeout } = options
    ? { ...defaultOptions, ...options }
    : defaultOptions;
  const html = await getHTML(url, timeout);
  const metadata = await parseMetadata(url, html, options);
  return metadata;
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
