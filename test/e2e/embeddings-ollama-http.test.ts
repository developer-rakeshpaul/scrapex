/**
 * Ollama Embeddings - Documentation Examples Validation
 *
 * Tests createOllamaEmbedding() with a local HTTP mock server.
 */
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOllamaEmbedding } from '@/embeddings/index.js';
import { embed } from '@/embeddings/index.js';

describe('Ollama Embeddings (local mock)', () => {
  let serverBaseUrl = '';
  let serverClose: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const server = createServer((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const { port } = server.address() as AddressInfo;
    serverBaseUrl = `http://127.0.0.1:${port}`;

    serverClose = () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
  });

  afterAll(async () => {
    if (serverClose) {
      await serverClose();
    }
  });

  it('embeds text via createOllamaEmbedding()', async () => {
    const provider = createOllamaEmbedding({
      baseUrl: `${serverBaseUrl}/api/embeddings`,
      model: 'nomic-embed-text',
    });

    const result = await embed('Hello embeddings world test', {
      provider: { type: 'custom', provider },
      output: { aggregation: 'average' },
    });

    expect(result.status).toBe('success');
    if (result.status === 'success' && result.aggregation === 'average') {
      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
    }
  });
});
