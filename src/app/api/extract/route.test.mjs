import assert from 'node:assert/strict';
import test from 'node:test';

// Dynamic import is deliberate, not stylistic: a static top-level `import`
// here resolves through a different tsx module-resolution path than
// route.ts's own `import { dependencies } from './dependencies'`, producing
// two separate object instances so mutating one wouldn't affect the other.
const { dependencies } = await import('./dependencies.ts');

const originalFetch = globalThis.fetch;
const originalDependencies = { ...dependencies };

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const USEFUL_DRAFT = {
  title: 'Meal Prep Chicken Breast',
  servings: '4',
  prepTime: '10 mins',
  cookTime: '25 mins',
  ingredients: [{ name: 'chicken breast', amount: '2', unit: 'pieces' }],
  instructions: ['Marinate the chicken.', 'Bake until cooked through.'],
  tags: ['Chicken', 'Meal Prep'],
};

const EMPTY_DRAFT = {
  title: '',
  servings: '',
  prepTime: '',
  cookTime: '',
  ingredients: [],
  instructions: [],
  tags: [],
};

// ---- request helpers ------------------------------------------------------

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

function openaiResponse(draft) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] });
}

function isVisionRequest(bodyJson) {
  const userMessage = bodyJson.messages.find((m) => m.role === 'user');
  return Array.isArray(userMessage?.content);
}

// ---- fetch mock (groq + openai only — media download no longer goes through fetch) ----
// openaiText/openaiVision are distinguished by request shape: vision requests
// have an array `content` (text + image_url parts), text-only requests have a
// plain string. Defaults: groq returns an irrelevant transcript, openaiText
// returns a USEFUL draft (happy path), openaiVision returns a USEFUL draft.

function createFetchMock({ groq, openaiText, openaiVision } = {}) {
  const calls = { groq: 0, openaiText: 0, openaiVision: 0, log: [] };

  async function impl(url, options = {}) {
    const key = String(url);
    calls.log.push(key);

    if (key === GROQ_URL) {
      calls.groq += 1;
      return groq ? groq(calls.groq) : Response.json({ text: 'unrelated background music lyrics' });
    }

    if (key === OPENAI_URL) {
      const bodyJson = JSON.parse(options.body);
      if (isVisionRequest(bodyJson)) {
        calls.openaiVision += 1;
        return openaiVision ? openaiVision(calls.openaiVision, bodyJson) : openaiResponse(USEFUL_DRAFT);
      }
      calls.openaiText += 1;
      return openaiText ? openaiText(calls.openaiText, bodyJson) : openaiResponse(USEFUL_DRAFT);
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

// ---- dependency mock (youtube-dl-exec / ffmpeg-static / fs) --------------
// Simulates: youtubedl "downloads" (no-op — content comes from the readFile
// mock), an info.json sidecar with a caption, an audio file, and up to
// `frameCount` numbered frame files. Anything else 404s like a real fs would.

function useDependencyMocks({ caption = 'Meal prepping chicken breast...', frameCount = 4, failDownload, failDownloadOnlyFirstCall = false, failExtractFrames } = {}) {
  const calls = { youtubedl: [], mkdtemp: 0, rm: [], execFileAsync: 0, readFile: [] };
  let workdirCounter = 0;

  dependencies.ffmpegPath = '/fake/ffmpeg';

  dependencies.mkdtemp = async () => {
    workdirCounter += 1;
    calls.mkdtemp += 1;
    return `/tmp/reelmeal-test-${workdirCounter}`;
  };

  dependencies.youtubedl = async (url, opts) => {
    calls.youtubedl.push({ url, opts });
    const isFirstCall = calls.youtubedl.length === 1;
    const shouldFail = failDownload && (!failDownloadOnlyFirstCall || isFirstCall);
    if (shouldFail) throw Object.assign(new Error('yt-dlp failed'), { stderr: failDownload });
    return {};
  };

  dependencies.readFile = async (filePath) => {
    const p = String(filePath);
    calls.readFile.push(p);

    if (p.endsWith('media.info.json')) return JSON.stringify({ description: caption });
    if (p.endsWith('media.mp3')) return Buffer.from('fake-audio-bytes');

    const frameMatch = p.match(/frame_(\d+)\.jpg$/);
    if (frameMatch) {
      const n = Number(frameMatch[1]);
      if (n <= frameCount) return Buffer.from(`fake-frame-${n}`);
    }

    const error = new Error(`ENOENT: ${p}`);
    error.code = 'ENOENT';
    throw error;
  };

  dependencies.rm = async (dir) => {
    calls.rm.push(dir);
  };

  dependencies.execFileAsync = async () => {
    calls.execFileAsync += 1;
    if (failExtractFrames) throw Object.assign(new Error('ffmpeg failed'), { stderr: failExtractFrames });
    return { stdout: '', stderr: '' };
  };

  return calls;
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
  Object.assign(dependencies, originalDependencies);
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

function setEnv(overrides = {}) {
  const merged = { GROQ_API_KEY: 'groq-key', OPENAI_API_KEY: 'openai-key', ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const DEMO_URL = 'https://www.instagram.com/reel/C8XyZ/';

// =====================================================================
// Request validation (unchanged by the yt-dlp/vision rewrite)
// =====================================================================

test('[validation] rejects a malformed JSON body', async () => {
  const { POST } = await import('./route.ts');
  const response = await POST(rawRequest('{not valid json'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, false);
  assert.equal(typeof body.error, 'string');
});

test('[validation] rejects a non-Instagram URL', async () => {
  const { POST } = await import('./route.ts');
  const response = await POST(request({ url: 'https://www.youtube.com/watch?v=abc', useMock: true }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /valid Instagram reel or post URL/);
});

test('[validation] accepts /reel/, /reels/, and /p/ URL formats', async () => {
  const { POST } = await import('./route.ts');
  for (const url of [
    'https://www.instagram.com/reel/C8XyZ/',
    'https://www.instagram.com/reels/DYrUc81IjAH/',
    'https://www.instagram.com/p/C8XyZ/',
  ]) {
    const response = await POST(request({ url, useMock: true }));
    const body = await response.json();
    assert.equal(body.success, true, `expected ${url} to be accepted`);
  }
});

// =====================================================================
// Mock mode
// =====================================================================

test('[mock] returns the mock recipe without touching yt-dlp/ffmpeg/fetch', async () => {
  const { POST } = await import('./route.ts');
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  dependencies.youtubedl = async () => { throw new Error('should not download'); };

  const response = await POST(request({ url: DEMO_URL, useMock: true }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.modelUsed, 'mock');
});

// =====================================================================
// Primary pipeline (audio-only) — happy path
// =====================================================================

test('[primary] a useful draft from the transcript succeeds without touching video/frames', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const depCalls = useDependencyMocks();
  const fetchCalls = useFetchMock({ openaiText: () => openaiResponse(USEFUL_DRAFT) });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.recipe.title, 'Meal Prep Chicken Breast');
  assert.equal(body.modelUsed, 'gpt-4o');
  assert.equal(depCalls.youtubedl.length, 1);
  assert.equal(depCalls.youtubedl[0].opts.keepVideo, undefined);
  assert.equal(depCalls.execFileAsync, 0, 'frame extraction should not run when the text path succeeds');
  assert.equal(fetchCalls.openaiVision, 0);
  assert.deepEqual(depCalls.rm, ['/tmp/reelmeal-test-1']);
});

test('[primary] passes the downloaded caption through to the extraction prompt', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks({ caption: 'UNIQUE_CAPTION_MARKER meal prep chicken' });
  const fetchCalls = useFetchMock({
    openaiText: (attempt, bodyJson) => {
      const userMessage = bodyJson.messages.find((m) => m.role === 'user');
      assert.match(userMessage.content, /UNIQUE_CAPTION_MARKER/);
      return openaiResponse(USEFUL_DRAFT);
    },
  });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(fetchCalls.openaiText, 1);
});

// =====================================================================
// Download / transcription failures + cached-transcript fallback
// =====================================================================

test('[fallback] download failure + cached transcript succeeds via text extraction', async () => {
  const { POST } = await import('./route.ts');
  await withDemoFallback(DEMO_URL, 'a cached transcript describing the recipe', async () => {
    setEnv();
    useDependencyMocks({ failDownload: 'network unreachable' });
    const fetchCalls = useFetchMock({ openaiText: () => openaiResponse(USEFUL_DRAFT) });

    const response = await POST(request({ url: DEMO_URL, useMock: false }));
    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.modelUsed, 'gpt-4o (cached transcript fallback)');
    assert.equal(fetchCalls.openaiVision, 0);
  });
});

test('[fallback] download failure with no cached transcript propagates the error', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks({ failDownload: 'network unreachable' });
  useFetchMock();

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /Failed to download video/);
  assert.match(body.error, /network unreachable/);
});

test('[fallback] transcription (groq) failure + cached transcript still succeeds', async () => {
  const { POST } = await import('./route.ts');
  await withDemoFallback(DEMO_URL, 'a cached transcript describing the recipe', async () => {
    setEnv();
    useDependencyMocks();
    const fetchCalls = useFetchMock({
      groq: () => new Response('groq is down', { status: 500 }),
      openaiText: () => openaiResponse(USEFUL_DRAFT),
    });

    const response = await POST(request({ url: DEMO_URL, useMock: false }));
    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.modelUsed, 'gpt-4o (cached transcript fallback)');
    assert.equal(fetchCalls.groq, 1);
  });
});

// =====================================================================
// Vision fallback cascade — the core new behavior
// =====================================================================

test('[vision] an empty-but-valid draft from text triggers the vision fallback, which succeeds', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const depCalls = useDependencyMocks({ frameCount: 5 });
  const fetchCalls = useFetchMock({
    openaiText: () => openaiResponse(EMPTY_DRAFT),
    openaiVision: () => openaiResponse(USEFUL_DRAFT),
  });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.recipe.title, 'Meal Prep Chicken Breast');
  assert.equal(body.modelUsed, 'gpt-4o (vision fallback)');
  assert.equal(depCalls.youtubedl.length, 2, 'should redownload with video kept for the fallback');
  assert.equal(depCalls.youtubedl[0].opts.keepVideo, undefined);
  assert.equal(depCalls.youtubedl[1].opts.keepVideo, true);
  assert.equal(depCalls.execFileAsync, 1);
  assert.equal(fetchCalls.openaiText, 2, 'an empty draft is retried once (same as any other unusable result) before falling back');
  assert.equal(fetchCalls.openaiVision, 1);
  assert.deepEqual(depCalls.rm.sort(), ['/tmp/reelmeal-test-1', '/tmp/reelmeal-test-2']);
});

test('[vision] a thrown text-extraction error (not just an empty draft) also triggers the vision fallback', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks();
  const fetchCalls = useFetchMock({
    openaiText: () => new Response('bad request', { status: 400 }),
    openaiVision: () => openaiResponse(USEFUL_DRAFT),
  });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.modelUsed, 'gpt-4o (vision fallback)');
  assert.equal(fetchCalls.openaiVision, 1);
});

test('[vision] cascades from a cached-transcript fallback into vision when that draft is also empty', async () => {
  const { POST } = await import('./route.ts');
  await withDemoFallback(DEMO_URL, 'cached transcript with no real recipe content', async () => {
    setEnv();
    // Only the first download attempt fails (triggering the cached-transcript
    // fallback) — the second (the vision fallback's own redownload-with-video)
    // succeeds, same as a network blip that clears up moments later.
    useDependencyMocks({ failDownload: 'network unreachable', failDownloadOnlyFirstCall: true });
    const fetchCalls = useFetchMock({
      openaiText: () => openaiResponse(EMPTY_DRAFT),
      openaiVision: () => openaiResponse(USEFUL_DRAFT),
    });

    const response = await POST(request({ url: DEMO_URL, useMock: false }));
    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.modelUsed, 'gpt-4o (cached transcript + vision fallback)');
    assert.equal(fetchCalls.openaiVision, 1);
  });
});

test('[vision] surfaces a clear error when frame extraction itself fails', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks({ failExtractFrames: 'ffmpeg: invalid data' });
  useFetchMock({ openaiText: () => openaiResponse(EMPTY_DRAFT) });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /Failed to extract video frames/);
  assert.match(body.error, /ffmpeg: invalid data/);
});

test('[vision] surfaces the redownload failure when the fallback video download itself fails', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  let callCount = 0;
  dependencies.ffmpegPath = '/fake/ffmpeg';
  dependencies.mkdtemp = async () => `/tmp/reelmeal-test-${++callCount}`;
  dependencies.youtubedl = async (url, opts) => {
    if (opts.keepVideo) throw Object.assign(new Error(), { stderr: 'second download failed' });
  };
  dependencies.readFile = async (p) => {
    if (String(p).endsWith('media.info.json')) return JSON.stringify({ description: '' });
    if (String(p).endsWith('media.mp3')) return Buffer.from('audio');
    const err = new Error('ENOENT');
    err.code = 'ENOENT';
    throw err;
  };
  dependencies.rm = async () => {};
  useFetchMock({ openaiText: () => openaiResponse(EMPTY_DRAFT) });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /Failed to download video/);
  assert.match(body.error, /second download failed/);
});

test('[vision] ultimate failure surfaces when the vision fallback also returns an empty draft', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks();
  useFetchMock({
    openaiText: () => openaiResponse(EMPTY_DRAFT),
    openaiVision: () => openaiResponse(EMPTY_DRAFT),
  });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /empty recipe/);
});

// =====================================================================
// Missing API keys
// =====================================================================

test('[keys] fails fast when GROQ_API_KEY is missing, after download already ran', async () => {
  const { POST } = await import('./route.ts');
  setEnv({ GROQ_API_KEY: undefined });
  const depCalls = useDependencyMocks();
  useFetchMock();

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /GROQ_API_KEY is not configured/);
  assert.equal(depCalls.youtubedl.length, 1);
});

test('[keys] fails fast when OPENAI_API_KEY is missing, after download+transcribe already ran', async () => {
  const { POST } = await import('./route.ts');
  setEnv({ OPENAI_API_KEY: undefined });
  useDependencyMocks();
  const fetchCalls = useFetchMock();

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, false);
  assert.match(body.error, /OPENAI_API_KEY is not configured/);
  assert.equal(fetchCalls.groq, 1);
});

// =====================================================================
// Retry / backoff (unchanged mechanics, still fetch-based)
// =====================================================================

test('[retry] retries once after a 429 and succeeds on the second attempt', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks();
  const fetchCalls = useFetchMock({
    openaiText: (attempt) => (attempt === 1 ? new Response('rate limited', { status: 429 }) : openaiResponse(USEFUL_DRAFT)),
  });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(fetchCalls.openaiText, 2);
});

test('[retry] exhausts retries when openai keeps returning 429, then falls back to vision', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks();
  const fetchCalls = useFetchMock({
    openaiText: () => new Response('rate limited', { status: 429 }),
    openaiVision: () => openaiResponse(USEFUL_DRAFT),
  });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.modelUsed, 'gpt-4o (vision fallback)');
  assert.equal(fetchCalls.openaiText, 2);
});

// =====================================================================
// Cleanup
// =====================================================================

test('[cleanup] removes every workdir created, including on the vision fallback path', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  const depCalls = useDependencyMocks();
  useFetchMock({
    openaiText: () => openaiResponse(EMPTY_DRAFT),
    openaiVision: () => openaiResponse(USEFUL_DRAFT),
  });

  await POST(request({ url: DEMO_URL, useMock: false }));

  assert.equal(depCalls.rm.length, 2);
});

// =====================================================================
// End-to-end response shape
// =====================================================================

test('[end-to-end] returns a fully-normalized recipe with a unique id and ISO timestamp', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks();
  useFetchMock({ openaiText: () => openaiResponse(USEFUL_DRAFT) });

  const response = await POST(request({ url: DEMO_URL, useMock: false }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.recipe.sourceUrl, DEMO_URL);
  assert.match(body.recipe.id, /.+/);
  assert.match(body.recipe.extractedAt, /^\d{4}-\d{2}-\d{2}T/);
  // Matches the shared Recipe type in src/types/recipe.ts — a real extraction
  // must include these or the frontend's collections/filtering features
  // silently receive undefined instead of an empty default.
  assert.deepEqual(body.recipe.tags, ['Chicken', 'Meal Prep']);
  assert.deepEqual(body.recipe.collections, []);
  assert.equal(body.recipe.savedAt, null);
});

test('[end-to-end] always responds with HTTP 200, even when everything fails', async () => {
  const { POST } = await import('./route.ts');
  setEnv();
  useDependencyMocks({ failDownload: 'boom' });
  useFetchMock();

  const response = await POST(request({ url: DEMO_URL, useMock: false }));

  assert.equal(response.status, 200);
});
