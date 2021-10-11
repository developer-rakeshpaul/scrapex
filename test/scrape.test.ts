const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import { scrape, scrapeHtml } from '../src';
import { SampleHtml } from './sample_html';

const keys = [
  'audio',
  'author',
  'logo',
  'publisher',
  'date',
  'description',
  'image',
  'lang',
  'title',
  'url',
  'text',
  'favicon',
  'tags',
  'content',
  'html',
];

describe('scrape', () => {
  it('throws error on invalid url', async () => {
    await expect(scrape('1')).rejects.toThrow('Invalid URL');
  });

  it('throws error on 404', async () => {
    await expect(
      scrape(
        'https://open-blog.dev/posts/slashgear/creating-an-image-lazy-loading-component-with-react/'
      )
    ).rejects.toThrow('getaddrinfo ENOTFOUND open-blog.dev');
  });

  const url = 'https://www.canva.com/learn/blog-header-design/';
  it('returns data for valid urls with default options', async () => {
    const data = await scrape(url);

    // delete data?.content;
    // delete data?.html;
    // delete data?.text;

    console.dir(data.text);
    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);

  it('returns data for valid urls', async () => {
    const data = await scrape(url, {
      metascraperRules: ['audio', 'youtube', 'iframe'],
    });

    // console.dir(data);
    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);

  it('returns data for valid html', async () => {
    const data = await scrapeHtml(url, SampleHtml, {
      metascraperRules: ['audio', 'youtube', 'iframe'],
    });

    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);
});
