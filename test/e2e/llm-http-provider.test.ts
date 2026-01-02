/**
 * HTTP LLM Provider - Documentation Examples Validation
 *
 * Tests createHttpLLM() with a local HTTP mock server to avoid external deps.
 */
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHttpLLM } from '@/llm/index.js';

describe('HTTP LLM Provider (local mock)', () => {
  let serverBaseUrl = '';
  let serverClose: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const server = createServer(async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        const prompt = JSON.stringify(parsed);

        const isJsonMode = prompt.includes('Respond ONLY with valid JSON');
        const content = isJsonMode
          ? JSON.stringify({ title: 'Mock Title', score: 0.95 })
          : 'Hello from the local LLM mock.';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content,
                },
              },
            ],
          })
        );
      });
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

  it('handles simple completions via createHttpLLM()', async () => {
    const provider = createHttpLLM({
      baseUrl: `${serverBaseUrl}/v1/chat/completions`,
      model: 'local-model',
      requireHttps: false,
      allowPrivate: true,
    });

    const response = await provider.complete('Say hello.');
    expect(response).toBe('Hello from the local LLM mock.');
  });

  it('handles structured JSON responses via completeJSON()', async () => {
    const provider = createHttpLLM({
      baseUrl: `${serverBaseUrl}/v1/chat/completions`,
      model: 'local-model',
      requireHttps: false,
      allowPrivate: true,
      jsonMode: true,
    });

    const schema = z.object({
      title: z.string(),
      score: z.number(),
    });

    const response = await provider.completeJSON('Return JSON only.', schema);
    expect(response.title).toBe('Mock Title');
    expect(response.score).toBe(0.95);
  });
});
