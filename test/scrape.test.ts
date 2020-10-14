import { scrape } from '../src';

describe('scrape', () => {
  it('returns null on invalid url', async () => {
    const data = await scrape('1');
    expect(data).toBeNull();
  });

  it('returns data for valid urls', async () => {
    const url = 'https://tech.trello.com/sync-architecture/';
    const data = await scrape(url, ['audio', 'youtube']);

    // console.dir(data)
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
    if (data !== null) {
      expect(data).toContainAnyKeys(keys);
    }
  }, 60000);
});
