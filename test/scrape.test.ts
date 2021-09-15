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
  it('returns null on invalid url', async () => {
    const data = await scrape('1');
    expect(data).toBeNull();
  });

  const url = 'https://whatthefuck.is/memoization';
  it('returns data for valid urls with default options', async () => {
    const data = await scrape(url);

    // delete data?.content;
    // delete data?.html;
    // delete data?.text;

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
