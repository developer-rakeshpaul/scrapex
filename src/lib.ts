import got from 'got';
import { URL } from 'url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { isUri } from 'valid-url';
import robotsParser from 'robots-parser';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
import { Readability } from '@mozilla/readability';
import UserAgent from 'user-agents';

export const getReadability = (url: string, html: string) => {
  const virtualConsole = new VirtualConsole();
  const jsdom = new JSDOM(html, {
    url,
    virtualConsole,
  });
  const article = new Readability(jsdom.window.document).parse();
  return article;
};

async function robotsAllowed(url: string) {
  const prefixUrl = new URL(url).origin;
  const robotsUrl = new URL('/robots.txt', prefixUrl);
  const site = await got(robotsUrl, {
    throwHttpErrors: false,
    agent: {
      http: new HttpAgent({ keepAlive: true }),
      https: new Agent({
        keepAlive: true,
      }),
    },

    timeout: 10 * 1000, // 10s request timeout
  });
  console.log(new UserAgent().toString());
  const robots = robotsParser(robotsUrl, site.body);
  return robots.isAllowed(url, new UserAgent().toString());
}

export const getHTML = async (
  url: string,
  timeout: number,
  respectRobots: boolean = true
) => {
  const valid = isUri(url);
  let isAllowed = false;

  if (!valid) throw new Error('Invalid URL');
  if (respectRobots) {
    isAllowed = await robotsAllowed(url);
  }

  console.log('robots allowed');
  if (isAllowed) {
    try {
      const { body: html } = await got(url, {
        headers: {
          'User-Agent': new UserAgent().toString(),
        },
        agent: {
          http: new HttpAgent({ keepAlive: true }),
          https: new Agent({ keepAlive: true }),
        },
        timeout: timeout * 1000, // 10s request timeout
      });

      return html;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to fetch HTML');
    }
  } else {
    throw new Error('Robots.txt disallowed');
  }
};

export function extractTwitterMeta($: cheerio.Root) {
  const TWITTER_META_TAGS = [
    'site',
    'creator',
    'description',
    'title',
    'image',
  ];
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

export function extractEmbeds(
  $: cheerio.Root
): Array<Record<string, string | undefined>> {
  const embeds: Array<Record<string, string | undefined>> = [];

  $('iframe, video, embed').each((_, el: cheerio.Element) => {
    embeds.push(getEmbedAttrs(el as cheerio.TagElement));
  });

  return embeds;
}

export function extractCodeSnippets($: cheerio.Root): string[] {
  const code: string[] = [];
  const codeBlocks = $('pre code');
  codeBlocks.each((_, el: cheerio.Element) => {
    code.push($(el).text());
  });
  return code;
}
