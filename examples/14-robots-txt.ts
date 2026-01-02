/**
 * 14-robots-txt.ts
 *
 * Check robots.txt before scraping.
 * Demonstrates respectful scraping practices.
 *
 * Run: npx tsx examples/14-robots-txt.ts
 */

import { checkRobotsTxt, ScrapeError, scrape } from '../src/index.js';

async function main() {
  console.log('=== Robots.txt Example ===\n');

  // Example 1: Check robots.txt manually
  console.log('--- Manual robots.txt Check ---');

  const urlsToCheck = [
    'https://www.google.com/search',
    'https://example.com/page',
    'https://github.com/user/repo',
  ];

  for (const url of urlsToCheck) {
    const result = await checkRobotsTxt(url, 'MyBot/1.0');
    console.log(`${url}`);
    console.log(`  Allowed: ${result.allowed}`);
    if (!result.allowed) {
      console.log(`  Reason: ${result.reason}`);
    }
  }

  // Example 2: Using respectRobots option
  console.log('\n--- respectRobots Option ---');

  try {
    // This will check robots.txt before scraping
    const result = await scrape('https://example.com', {
      respectRobots: true,
      userAgent: 'MyBot/1.0',
    });
    console.log('Scrape succeeded:', result.title);
  } catch (error) {
    if (error instanceof ScrapeError && error.code === 'ROBOTS_BLOCKED') {
      console.log('Blocked by robots.txt:', error.message);
    } else {
      throw error;
    }
  }

  // Example 3: Conditional scraping based on robots.txt
  console.log('\n--- Conditional Scraping ---');

  async function scrapeIfAllowed(url: string, userAgent: string) {
    const robotsCheck = await checkRobotsTxt(url, userAgent);

    if (!robotsCheck.allowed) {
      console.log(`Skipping ${url}: ${robotsCheck.reason}`);
      return null;
    }

    console.log(`Scraping ${url} (robots.txt allows)`);
    return await scrape(url, { userAgent });
  }

  const result = await scrapeIfAllowed('https://example.com', 'MyBot/1.0');
  if (result) {
    console.log('Got:', result.title);
  }

  // Example 4: Best practices
  console.log('\n--- Best Practices ---');
  console.log(`
1. Always identify your bot with a descriptive User-Agent:
   userAgent: 'MyCompanyBot/1.0 (+https://mycompany.com/bot)'

2. Include contact information in User-Agent for webmasters

3. Respect robots.txt for production scrapers:
   await scrape(url, { respectRobots: true })

4. Add delays between requests to avoid overwhelming servers

5. Check robots.txt Crawl-delay directive (if present)

6. Handle ROBOTS_BLOCKED errors gracefully
`);

  // Example 5: Custom User-Agent with contact
  console.log('--- Proper Bot Identification ---');

  const properUserAgent =
    'ScrapexBot/2.0 (+https://github.com/developer-rakeshpaul/scrapex; bot@example.com)';

  console.log(`User-Agent: ${properUserAgent}`);

  const properResult = await scrape('https://example.com', {
    userAgent: properUserAgent,
    respectRobots: true,
  });

  console.log('Scraped with proper identification:', properResult.title);
}

main().catch(console.error);
