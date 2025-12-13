/**
 * 04-custom-extractors.ts
 *
 * Create custom extractors for domain-specific data extraction.
 * Extractors run in priority order (higher priority = runs first).
 *
 * Run: npx tsx examples/04-custom-extractors.ts
 */

import {
  type ExtractionContext,
  type Extractor,
  type ScrapedData,
  scrapeHtml,
} from '../src/index.js';

// Example 1: Recipe Extractor
// Extracts structured recipe data from cooking websites
const recipeExtractor: Extractor = {
  name: 'recipe',
  priority: 60, // Runs after meta (100) and JSON-LD (80), before content (50)

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $ } = context;

    // Check if this is a recipe page
    const hasRecipeSchema = $('script[type="application/ld+json"]').text().includes('Recipe');
    const hasRecipeMarkup = $('[itemtype*="Recipe"]').length > 0;

    if (!hasRecipeSchema && !hasRecipeMarkup) {
      return {}; // Not a recipe page, return empty
    }

    // Extract recipe data using common patterns
    const ingredients: string[] = [];
    $('.ingredients li, [itemprop="recipeIngredient"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) ingredients.push(text);
    });

    const instructions: string[] = [];
    $('.instructions li, [itemprop="recipeInstructions"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) instructions.push(text);
    });

    return {
      custom: {
        recipe: {
          ingredients,
          instructions,
          prepTime: $('[itemprop="prepTime"]').attr('content') || null,
          cookTime: $('[itemprop="cookTime"]').attr('content') || null,
          servings: $('[itemprop="recipeYield"]').text().trim() || null,
          calories: $('[itemprop="calories"]').text().trim() || null,
        },
      },
    };
  },
};

// Example 2: E-commerce Product Extractor
const productExtractor: Extractor = {
  name: 'product',
  priority: 65,

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $ } = context;

    // Look for common e-commerce patterns
    const priceSelectors = [
      '[itemprop="price"]',
      '.price',
      '.product-price',
      '[data-price]',
      '.amount',
    ];

    let price: string | null = null;
    for (const selector of priceSelectors) {
      const el = $(selector).first();
      const text = el.attr('content') || el.text().trim();
      if (text && /[\d.,]+/.test(text)) {
        price = text;
        break;
      }
    }

    if (!price) {
      return {}; // Not a product page
    }

    return {
      custom: {
        product: {
          price,
          currency: $('[itemprop="priceCurrency"]').attr('content') || 'USD',
          sku: $('[itemprop="sku"]').text().trim() || null,
          availability: $('[itemprop="availability"]').attr('content') || null,
          brand: $('[itemprop="brand"]').text().trim() || null,
          rating: $('[itemprop="ratingValue"]').text().trim() || null,
          reviewCount: $('[itemprop="reviewCount"]').text().trim() || null,
        },
      },
    };
  },
};

// Example 3: Social Stats Extractor
const socialExtractor: Extractor = {
  name: 'social',
  priority: 40, // Lower priority, runs later

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $ } = context;

    return {
      custom: {
        social: {
          twitterHandle: $('meta[name="twitter:site"]').attr('content') || null,
          facebookPage: $('meta[property="fb:pages"]').attr('content') || null,
          shareCount: $('[data-share-count]').attr('data-share-count') || null,
        },
      },
    };
  },
};

async function main() {
  console.log('=== Custom Extractors Example ===\n');

  // Sample recipe HTML
  const recipeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chocolate Chip Cookies Recipe</title>
      <script type="application/ld+json">
        { "@type": "Recipe", "name": "Chocolate Chip Cookies" }
      </script>
    </head>
    <body>
      <h1>Chocolate Chip Cookies</h1>
      <div class="ingredients">
        <h2>Ingredients</h2>
        <ul>
          <li itemprop="recipeIngredient">2 cups flour</li>
          <li itemprop="recipeIngredient">1 cup sugar</li>
          <li itemprop="recipeIngredient">1 cup chocolate chips</li>
          <li itemprop="recipeIngredient">2 eggs</li>
        </ul>
      </div>
      <div class="instructions">
        <h2>Instructions</h2>
        <ol itemprop="recipeInstructions">
          <li>Preheat oven to 350°F</li>
          <li>Mix dry ingredients</li>
          <li>Add wet ingredients</li>
          <li>Bake for 12 minutes</li>
        </ol>
      </div>
      <span itemprop="prepTime" content="PT15M">Prep: 15 min</span>
      <span itemprop="cookTime" content="PT12M">Cook: 12 min</span>
      <span itemprop="recipeYield">24 cookies</span>
    </body>
    </html>
  `;

  // Scrape with custom extractors
  const result = await scrapeHtml(recipeHtml, 'https://recipes.example.com/cookies', {
    extractors: [recipeExtractor, productExtractor, socialExtractor],
  });

  console.log('--- Standard Fields ---');
  console.log('Title:', result.title);

  console.log('\n--- Custom Recipe Data ---');
  console.log(JSON.stringify(result.custom?.recipe, null, 2));

  // Example: Product page
  console.log('\n--- Product Extractor Example ---');
  const productHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Amazing Widget</title></head>
    <body>
      <h1>Amazing Widget Pro</h1>
      <span itemprop="price" content="99.99">$99.99</span>
      <meta itemprop="priceCurrency" content="USD">
      <span itemprop="sku">WIDGET-PRO-001</span>
      <span itemprop="brand">WidgetCo</span>
      <link itemprop="availability" href="https://schema.org/InStock">
      <span itemprop="ratingValue">4.5</span>
      <span itemprop="reviewCount">128</span>
    </body>
    </html>
  `;

  const productResult = await scrapeHtml(productHtml, 'https://shop.example.com/widget', {
    extractors: [productExtractor],
  });

  console.log('Product Data:');
  console.log(JSON.stringify(productResult.custom?.product, null, 2));

  // Example: Replace default extractors entirely
  console.log('\n--- Replace Default Extractors ---');
  const minimalExtractor: Extractor = {
    name: 'minimal',
    priority: 100,
    async extract({ $ }): Promise<Partial<ScrapedData>> {
      return {
        title: $('title').text(),
        custom: { extractorUsed: 'minimal-only' },
      };
    },
  };

  const minimalResult = await scrapeHtml(recipeHtml, 'https://example.com', {
    extractors: [minimalExtractor],
    replaceDefaultExtractors: true,
  });

  console.log('Title:', minimalResult.title);
  console.log('Extractor used:', minimalResult.custom?.extractorUsed);
  console.log('Content extracted:', minimalResult.content.length > 0 ? 'Yes' : 'No (skipped)');
}

main().catch(console.error);
