import assert from 'node:assert/strict';
import test from 'node:test';

const originalFetch = globalThis.fetch;

const COBALT_URL = 'https://cobalt.example.test/';
const AUDIO_URL = 'https://cdn.example.test/reel.mp3';
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const VALID_DRAFT = {
  title: 'Tomato Basil Pasta',
  servings: '2',
  prepTime: '5 mins',
  cookTime: '15 mins',
  ingredients: [{ name: 'Pasta', amount: '200', unit: 'g' }],
  instructions: ['Boil the pasta.', 'Toss with tomatoes and basil.'],
};

// ---- request/response builders -------------------------------------------

function request(payload) {
  return new Request('http://localhost/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function rawRequest(rawBody) {
  return new Request('http://localhost/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
}

function openaiSuccessResponse(draft = VALID_DRAFT) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] });
}

function cobaltTunnelResponse(url = AUDIO_URL) {
  return Response.json({ status: 'tunnel', url, filename: 'reel.mp3' });
}

// ---- fetch mock -------------------------------------------------------
// Each of cobalt/audio/groq/openai defaults to a happy-path response.
// Pass a handler `(attemptNumber, options) => Response` to override one leg;
// `calls` records how many times each leg was hit, for retry/short-circuit assertions.

function createFetchMock({ cobalt, audio, groq, openai } = {}) {
  const calls = { cobalt: 0, audio: 0, groq: 0, openai: 0, log: [] };

  async function impl(url, options = {}) {
    const key = String(url);
    calls.log.push(key);

    if (key === COBALT_URL) {
      calls.cobalt += 1;
      return cobalt ? cobalt(calls.cobalt, options) : cobaltTunnelResponse();
    }
    if (key === AUDIO_URL) {
      calls.audio += 1;
      return audio ? audio(calls.audio, options) : new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    if (key === GROQ_URL) {
      calls.groq += 1;
      return groq ? groq(calls.groq, options) : Response.json({ text: 'Make pasta with tomatoes and basil.' });
    }
    if (key === OPENAI_URL) {
      calls.openai += 1;
      return openai ? openai(calls.openai, options) : openaiSuccessResponse();
    }

    throw new Error(`Unexpected fetch to: ${key}`);
  }

  return { impl, calls };
}

function useFetchMock(handlers) {
  const mock = createFetchMock(handlers);
  globalThis.fetch = mock.impl;
  return mock.calls;
}

// ---- env helper ---------------------------------------------------------
// Defaults all three required env vars; pass `{ KEY: undefined }` to omit one.

function setEnv(overrides = {}) {
  const merged = {
    GROQ_API_KEY: 'groq-key',
    OPENAI_API_KEY: 'openai-key',
    COBALT_API_URL: COBALT_URL,
    ...overrides,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function withDemoFallback(url, transcript, fn) {
  const { DEMO_FALLBACK_TRANSCRIPTS } = await import('../../../utils/demoFallbacks.ts');
  DEMO_FALLBACK_TRANSCRIPTS[url] = transcript;
  try {
    await fn();
  } finally {
    delete DEMO_FALLBACK_TRANSCRIPTS[url];
  }
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.COBALT_API_URL;
});

// =====================================================================
// Request validation
// =====================================================================

test('[validation] rejects a malformed JSON body', async () => {
  const { POST } = await import('./route.ts');
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('should not fetch'); };

  const response = await POST(rawRequest('{not valid json'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, false);
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
  assert.equal(fetchCalls, 0);
});

test('[validation] rejects a body missing the url field', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };

  const response = await POST(request({ useMock: true }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /url and useMock/);
});

test('[validation] rejects a body where useMock is not a boolean', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };

  const response = await POST(request({
    url: 'https://www.instagram.com/reel/C8XyZ/',
    useMock: 'true',
  }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /url and useMock/);
});

test('[validation] rejects a non-Instagram URL', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };

  const response = await POST(request({
    url: 'https://www.youtube.com/watch?v=abc123',
    useMock: true,
  }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /valid Instagram reel or post URL/);
});

test('[validation] accepts a singular /reel/ URL', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: true }));
  const body = await response.json();

  assert.equal(body.success, true);
});

test('[validation] accepts a plural /reels/ URL', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };

  const response = await POST(request({ url: 'https://www.instagram.com/reels/DYrUc81IjAH/', useMock: true }));
  const body = await response.json();

  assert.equal(body.success, true);
});

test('[validation] accepts a /p/ post URL', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };

  const response = await POST(request({ url: 'https://www.instagram.com/p/C8XyZ/', useMock: true }));
  const body = await response.json();

  assert.equal(body.success, true);
});

test('[validation] trims surrounding whitespace before validating and echoing the url', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock();

  const response = await POST(request({
    url: '  https://www.instagram.com/reel/C8XyZ/  ',
    useMock: false,
  }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.recipe.sourceUrl, 'https://www.instagram.com/reel/C8XyZ/');
});

// =====================================================================
// Mock mode
// =====================================================================

test('[mock] returns the mock recipe without requesting external services', async () => {
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

// =====================================================================
// cobalt / downloadAudio
// =====================================================================

test('[cobalt] fails fast when COBALT_API_URL is not configured', async () => {
  const { POST } = await import('./route.ts');
  setEnv({ COBALT_API_URL: undefined });
  const calls = useFetchMock();

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /COBALT_API_URL is not configured/);
  assert.equal(calls.cobalt, 0);
});

test('[cobalt] surfaces a clear error when cobalt returns a non-JSON response', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => new Response('<html>Bad Gateway</html>', { status: 502 }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /non-JSON response/);
  assert.match(body.error, /502/);
});

test('[cobalt] surfaces a clear error when the response is missing a status field', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => Response.json({ foo: 'bar' }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /unexpected cobalt response shape/);
});

test('[cobalt] surfaces cobalt\'s error code when status is "error"', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => Response.json({ status: 'error', error: { code: 'content.too_short' } }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /content\.too_short/);
});

test('[cobalt] falls back to "unknown_error" when an error status has no usable error code', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => Response.json({ status: 'error' }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /unknown_error/);
});

test('[cobalt] rejects unsupported statuses such as "picker"', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => Response.json({ status: 'picker', picker: [] }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /unsupported cobalt response status/);
  assert.match(body.error, /picker/);
});

test('[cobalt] errors when a tunnel status has no url', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => Response.json({ status: 'tunnel' }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /did not return a stream URL/);
});

test('[cobalt] surfaces the response body when the audio stream fetch itself fails', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    audio: () => new Response('Not Found', { status: 404 }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /Failed to download audio stream/);
  assert.match(body.error, /Not Found/);
});

// =====================================================================
// groq / transcribeAudio
// =====================================================================

test('[groq] fails fast when GROQ_API_KEY is not configured, after cobalt already succeeded', async () => {
  const { POST } = await import('./route.ts');
  setEnv({ GROQ_API_KEY: undefined });
  const calls = useFetchMock();

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /GROQ_API_KEY is not configured/);
  assert.equal(calls.cobalt, 1);
  assert.equal(calls.audio, 1);
  assert.equal(calls.groq, 0);
});

test('[groq] surfaces the response body when groq responds with an error status', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    groq: () => new Response('service unavailable', { status: 503 }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /Failed to transcribe audio/);
  assert.match(body.error, /service unavailable/);
});

test('[groq] errors when the transcript text is empty', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    groq: () => Response.json({ text: '' }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /no transcript was returned/);
});

test('[groq] errors when the transcript text is whitespace-only', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    groq: () => Response.json({ text: '   ' }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /no transcript was returned/);
});

// =====================================================================
// openai / extractRecipe — retry and backoff behavior
// =====================================================================

test('[openai] fails fast when OPENAI_API_KEY is not configured, after cobalt+groq succeeded', async () => {
  const { POST } = await import('./route.ts');
  setEnv({ OPENAI_API_KEY: undefined });
  const calls = useFetchMock();

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /OPENAI_API_KEY is not configured/);
  assert.equal(calls.cobalt, 1);
  assert.equal(calls.groq, 1);
  assert.equal(calls.openai, 0);
});

test('[openai] does not retry a non-transient 4xx error', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: () => new Response('bad request', { status: 400 }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /bad request/);
  assert.equal(calls.openai, 1);
});

test('[openai] retries once after a 429 and succeeds on the second attempt', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: (attempt) => (attempt === 1 ? new Response('rate limited', { status: 429 }) : openaiSuccessResponse()),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.recipe.title, 'Tomato Basil Pasta');
  assert.equal(calls.openai, 2);
});

test('[openai] exhausts retries when openai keeps returning 429', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: () => new Response('rate limited by openai', { status: 429 }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /rate limited by openai/);
  assert.equal(calls.openai, 2);
});

test('[openai] retries a transient 5xx the same way as a 429', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: (attempt) => (attempt === 1 ? new Response('temporarily unavailable', { status: 503 }) : openaiSuccessResponse()),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(calls.openai, 2);
});

test('[openai] retries once when the response has no message content', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: (attempt) => (attempt === 1 ? Response.json({ choices: [{ message: {} }] }) : openaiSuccessResponse()),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(calls.openai, 2);
});

test('[openai] retries once when the content is not valid JSON', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: (attempt) => (attempt === 1
      ? Response.json({ choices: [{ message: { content: 'not valid json {' } }] })
      : openaiSuccessResponse()),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(calls.openai, 2);
});

test('[openai] retries once when parsed content fails recipe-shape validation', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock({
    openai: (attempt) => (attempt === 1
      ? openaiSuccessResponse({ title: 'Missing everything else' })
      : openaiSuccessResponse()),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(calls.openai, 2);
});

test('[openai] never calls OpenRouter — the cascade was intentionally removed', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock();

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.modelUsed, 'gpt-4o');
  assert.ok(!calls.log.some((url) => url.includes('openrouter.ai')));
});

// =====================================================================
// getTranscript — demo fallback behavior
// =====================================================================

test('[fallback] falls back to a cached transcript when cobalt fails for a known demo url, and still extracts live', async () => {
  const { POST } = await import('./route.ts');
  const demoUrl = 'https://www.instagram.com/reel/DemoReel1/';

  await withDemoFallback(demoUrl, 'Make pasta with tomatoes and basil.', async () => {
    setEnv();
    const calls = useFetchMock({
      cobalt: () => Response.json({ status: 'error', error: { code: 'content.too_short' } }),
    });

    const response = await POST(request({ url: demoUrl, useMock: false }));
    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.recipe.title, 'Tomato Basil Pasta');
    assert.equal(body.modelUsed, 'gpt-4o (cached transcript fallback)');
    assert.equal(calls.cobalt, 1, 'should genuinely attempt the live path first');
    assert.equal(calls.openai, 1, 'extraction should still run live against the fallback transcript');
  });
});

test('[fallback] falls back when transcription (groq) fails, not just cobalt', async () => {
  const { POST } = await import('./route.ts');
  const demoUrl = 'https://www.instagram.com/reel/DemoReel2/';

  await withDemoFallback(demoUrl, 'Make pasta with tomatoes and basil.', async () => {
    setEnv();
    const calls = useFetchMock({
      groq: () => new Response('groq is down', { status: 500 }),
    });

    const response = await POST(request({ url: demoUrl, useMock: false }));
    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.modelUsed, 'gpt-4o (cached transcript fallback)');
    assert.equal(calls.cobalt, 1);
    assert.equal(calls.audio, 1);
    assert.equal(calls.groq, 1);
    assert.equal(calls.openai, 1);
  });
});

test('[fallback] propagates the original error when no cached fallback exists for the url', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock({
    cobalt: () => Response.json({ status: 'error', error: { code: 'content.too_short' } }),
  });

  const response = await POST(request({ url: 'https://www.instagram.com/reel/NoFallback/', useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /content\.too_short/);
});

// =====================================================================
// End-to-end response shape
// =====================================================================

test('[end-to-end] returns a fully-normalized recipe after a complete successful pipeline run', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const calls = useFetchMock();

  const response = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.recipe.title, 'Tomato Basil Pasta');
  assert.equal(body.recipe.sourceUrl, 'https://www.instagram.com/reel/C8XyZ/');
  assert.match(body.recipe.id, /.+/);
  assert.match(body.recipe.extractedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(body.modelUsed, 'gpt-4o');
  assert.equal(calls.cobalt, 1);
  assert.equal(calls.audio, 1);
  assert.equal(calls.groq, 1);
  assert.equal(calls.openai, 1);
});

test('[end-to-end] generates a different recipe id on each successful call', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useFetchMock();

  const first = await (await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }))).json();
  const second = await (await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }))).json();

  assert.notEqual(first.recipe.id, second.recipe.id);
});

test('[end-to-end] always responds with HTTP 200, even when the pipeline fails', async () => {
  const { POST } = await import('./route.ts');

  const invalidUrlResponse = await POST(request({ url: 'https://example.com/not-instagram', useMock: true }));
  assert.equal(invalidUrlResponse.status, 200);

  setEnv({ COBALT_API_URL: undefined });
  useFetchMock();
  const pipelineFailureResponse = await POST(request({ url: 'https://www.instagram.com/reel/C8XyZ/', useMock: false }));
  assert.equal(pipelineFailureResponse.status, 200);
});
