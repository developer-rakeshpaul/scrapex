import { Readability } from '@mozilla/readability';
import cheerio from 'cheerio';
import { createWindow } from 'domino';
import { JSDOM } from 'jsdom';
import get from 'lodash.get';
import uniq from 'lodash.uniq';
import metascraper, { Metadata } from 'metascraper';

import metascraperAuthor from 'metascraper-author';
import metascraperClearbit from 'metascraper-clearbit';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLang from 'metascraper-lang';
import metascraperLogoFavicon from 'metascraper-logo-favicon';
import metascraperPublisher from 'metascraper-publisher';
import metascraperReadability from 'metascraper-readability';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';
import fetch from 'node-fetch';
import { getMetadata } from 'page-metadata-parser';
import robotsParser from 'robots-parser';
import sanitize from 'sanitize-html';
import urlparse from 'url';
import { isUri } from 'valid-url';

const userAgent =
  'Scrapex metadata parser https://github.com/developer-rakeshpaul/scrapex';

const TWITTER_META_TAGS = ['site', 'creator', 'description', 'title', 'image'];

export interface ILink {
  text?: string;
  href?: string;
}

export interface IMetadata extends Metadata {
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

function getEmbedAttrs(el: cheerio.Element) {
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
  $('iframe, embed, object, video').each((_, el: cheerio.Element) => {
    if (el.tagName === 'embed') {
      if (el.parent && el.parent.name === 'object') {
        // console.log('embed:object => ',el)
      } else {
        embeds.push(getEmbedAttrs(el));
      }
      // } else if (el.tagName === 'object') {
      // console.log('object: ', el);
      // return videoList.push(getObjectTag(doc, candidate));
    } else if (el.tagName === 'iframe' || el.tagName === 'video') {
      embeds.push(getEmbedAttrs(el));
    }
  });

  return embeds;
}

async function robotsAllowed(url: string) {
  const robotsUrl = urlparse.resolve(url, '/robots.txt');
  const site = await fetch(robotsUrl, {
    headers: {
      'User-Agent': userAgent,
    },
    timeout: 10 * 1000, // 10s request timeout
  });
  const html = await site.text();
  const robots = robotsParser(robotsUrl, html);
  return robots.isAllowed(url, userAgent);
}

const defaultRules = [
  metascraperAuthor(),
  metascraperClearbit(),
  metascraperDate(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLang(),
  metascraperLogoFavicon(),
  metascraperPublisher(),
  metascraperReadability(),
  metascraperTitle(),
  metascraperUrl(),
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

export const scrape = async (
  url: string,
  metascraperRules: Array<MetaScraperRules> = [],
  timeout = 60
): Promise<IMetadata | null> => {
  const valid = isUri(url);

  if (valid) {
    try {
      const parsedUrl = new URL(url);
      const isAllowed = await robotsAllowed(url);

      if (isAllowed) {
        const rules = metascraperRules.map((rule: string) =>
          require(`metascraper-${rule}`)()
        );

        const scraper = metascraper([...defaultRules, ...rules]);
        const site = await fetch(url, {
          headers: {
            'User-Agent': userAgent,
          },
          timeout: timeout * 1000, // 10s request timeout
        });
        const html = await site.text();
        const $: cheerio.Root = cheerio.load(html);

        const metadata: Metadata = await scraper({ html, url });
        // console.log([...rules], metadata)
        const doc = createWindow(html).document;
        const data: PageMetaData = getMetadata(doc, url);
        const jsdom = new JSDOM(html, {
          url,
        });
        const article = new Readability(jsdom.window.document).parse();

        const content = sanitize(article?.content || '', {
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
        })
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
        const title = article?.title || get(metadata, 'title');
        // console.dir({ metadata });
        // console.dir({ defaultRules, rules });
        const text = sanitize(content || '', {
          allowedTags: [],
          allowedAttributes: {},
        });
        return {
          html,
          content,
          ...metadata,
          author: article?.byline || get(metadata, 'author'),
          favicon: get(data, 'icon'),
          publisher: article?.siteName || get(metadata, 'publisher'),
          description: article?.excerpt || get(metadata, 'description'),
          lang: get(metadata, 'lang') || get(data, 'lang'),
          url: get(data, 'url') || get(metadata, 'url'),
          text,
          embeds,
          tags: uniq(tags),
          source: parsedUrl.hostname,
          twitter: extractTwitterMeta($),
          title,
          links,
          keywords: get(data, 'keywords', []),
        };
      }
    } catch (error) {
      console.error(error);
    }
  }
  return null;
};
