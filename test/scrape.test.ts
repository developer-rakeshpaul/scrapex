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

  it('returns data for valid urls with default options', async () => {
    const url = 'https://blitzjs.com/';
    const data = await scrape(url);

    console.dir(data?.title);
    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);

  it('returns data for valid urls', async () => {
    const url = 'https://blitzjs.com/';
    const data = await scrape(url, {
      metascraperRules: ['audio', 'youtube', 'iframe'],
    });

    // console.dir(data);
    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);

  it('returns data for valid html', async () => {
    const url = 'https://blitzjs.com/';
    const data = await scrapeHtml(url, SampleHtml, {
      metascraperRules: ['audio', 'youtube', 'iframe'],
    });

    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);
});
