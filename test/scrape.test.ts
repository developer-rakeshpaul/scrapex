import { scrape } from '../src';

describe('scrape', () => {
  it('returns null on invalid url', async () => {
    const data = await scrape('1');
    expect(data).toBeNull();
  });

  it('returns data for valid urls', async () => {
    const url =
      'https://appleinsider.com/articles/19/08/22/like-apple-music-spotify-now-offers-a-three-month-premium-trial';
    const data = await scrape(url);

    console.log('data :', data);
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

    expect(data).toContainAnyKeys(keys);
  });
});
