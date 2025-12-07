import {
  type ExtractionContext,
  type Extractor,
  type ScrapedData,
  scrapeHtml,
} from '../dist/index.mjs';

// Define custom product data type
interface ProductData {
  name: string;
  price: string;
  customField: string;
}

// Define a custom extractor
class ProductExtractor implements Extractor {
  readonly name = 'product';
  readonly priority = 60;

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $ } = context;

    return {
      custom: {
        product: {
          name: $('h1').text() || 'Demo Product',
          price: '$99.99',
          customField: 'Extracted by Custom Plugin',
        } as ProductData,
      },
    };
  }
}

async function main() {
  console.log('Running custom extractor example...');

  // Mock HTML content to scrape
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Test Product</title></head>
      <body>
        <h1>Super Gadget 3000</h1>
        <div class="price">$199.00</div>
      </body>
    </html>
  `;

  const result = await scrapeHtml(html, 'https://example.com/product', {
    extractors: [new ProductExtractor()],
  });

  console.log('--- Result ---');
  console.log('Title:', result.title);
  console.log('Custom Data:', JSON.stringify(result.custom, null, 2));

  const product = result.custom?.product as ProductData | undefined;
  if (product?.customField === 'Extracted by Custom Plugin') {
    console.log('Custom extractor works!');
  } else {
    console.error('Custom extractor failed');
    process.exit(1);
  }
}

main().catch(console.error);
