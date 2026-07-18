import assert from 'node:assert/strict';
import test from 'node:test';

const originalFetch = globalThis.fetch;

function request(payload) {
  return new Request('http://localhost/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

test('returns the mock recipe without requesting external services', async () => {
  const { POST } = await import('./route.ts');
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('External services should not be called for mock requests');
  };

  const response = await POST(request({
    url: 'https://www.instagram.com/reel/C8XyZ/',
    useMock: true,
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.modelUsed, 'mock');
  assert.equal(body.recipe.sourceUrl, 'https://www.instagram.com/reel/C8XyZ/');
  assert.equal(fetchCalls, 0);
});

test('returns a normalized recipe after downloading, transcribing, and extracting audio', async () => {
  const { POST } = await import('./route.ts');
  process.env.GROQ_API_KEY = 'groq-key';
  process.env.OPENROUTER_API_KEY = 'router-key';

  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });

    if (String(url) === 'https://api.cobalt.tools/api/json') {
      return Response.json({ url: 'https://cdn.example.test/reel.mp3' });
    }
    if (String(url) === 'https://cdn.example.test/reel.mp3') {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    if (String(url) === 'https://api.groq.com/openai/v1/audio/transcriptions') {
      return Response.json({ text: 'Make pasta with tomatoes and basil.' });
    }
    if (String(url) === 'https://openrouter.ai/api/v1/chat/completions') {
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Tomato Basil Pasta',
              servings: '2',
              prepTime: '5 mins',
              cookTime: '15 mins',
              ingredients: [{ name: 'Pasta', amount: '200', unit: 'g' }],
              instructions: ['Boil the pasta.', 'Toss with tomatoes and basil.'],
            }),
          },
        }],
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const response = await POST(request({
    url: 'https://www.instagram.com/reel/C8XyZ/',
    useMock: false,
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.recipe.title, 'Tomato Basil Pasta');
  assert.equal(body.recipe.sourceUrl, 'https://www.instagram.com/reel/C8XyZ/');
  assert.match(body.recipe.id, /.+/);
  assert.match(body.recipe.extractedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(body.modelUsed, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(requests.length, 4);
});
