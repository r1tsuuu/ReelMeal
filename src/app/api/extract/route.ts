import { DEMO_FALLBACK_TRANSCRIPTS } from '@/utils/demoFallbacks';

// Vercel Hobby plan caps serverless functions at 60s (not 300s, which needs
// Pro). The cascade below is trimmed to fit worst-case retries in that budget.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type Ingredient = {
  name: string;
  amount: string;
  unit: string;
};

type Recipe = {
  id: string;
  title: string;
  sourceUrl: string;
  extractedAt: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: Ingredient[];
  instructions: string[];
};

type RecipeDraft = Omit<Recipe, 'id' | 'sourceUrl' | 'extractedAt'>;

const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const EXTRACTION_MAX_ATTEMPTS = 2;
const EXTRACTION_RETRY_DELAY_MS = 1500;

const recipeSystemPrompt = [
  'You are a culinary analyst. Extract recipe details from an audio transcription.',
  'Return ONLY valid JSON with no markdown or code fences.',
  'Use exactly this schema:',
  '{"title":"string","servings":"string","prepTime":"string","cookTime":"string",',
  '"ingredients":[{"name":"string","amount":"string","unit":"string"}],',
  '"instructions":["string"]}.',
  'Use an empty string when a value is not stated, and do not invent ingredients or steps.',
].join(' ');

const mockRecipe: Recipe = {
  id: 'mock-1',
  title: 'Crispy Garlic Parmesan Potatoes',
  sourceUrl: 'https://www.instagram.com/reel/C8XyZ/',
  extractedAt: new Date().toISOString(),
  servings: '4',
  prepTime: '10 mins',
  cookTime: '25 mins',
  ingredients: [
    { name: 'Baby Yukon Gold Potatoes', amount: '1.5', unit: 'lbs' },
    { name: 'Olive Oil', amount: '2', unit: 'tbsp' },
    { name: 'Garlic Powder', amount: '1', unit: 'tbsp' },
    { name: 'Parmesan Cheese', amount: '1/2', unit: 'cup' },
    { name: 'Sea Salt & Pepper', amount: 'to taste', unit: '' },
  ],
  instructions: [
    'Wash and halve potatoes.',
    'Toss with oil, garlic, salt, pepper, and parmesan.',
    'Arrange cut-side down on a sheet pan.',
    'Roast at 200°C for 25 minutes until golden.',
    'Serve immediately with crispy cheese edges.',
  ],
};

class PipelineError extends Error {}

function json(body: unknown) {
  return Response.json(body, { status: 200 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecipeDraft(value: unknown): value is RecipeDraft {
  if (!isRecord(value)) return false;

  if (!['title', 'servings', 'prepTime', 'cookTime'].every((key) => isString(value[key]))) {
    return false;
  }

  if (!Array.isArray(value.ingredients) || !Array.isArray(value.instructions)) return false;

  return value.ingredients.every((ingredient) => (
    isRecord(ingredient)
    && isString(ingredient.name)
    && isString(ingredient.amount)
    && isString(ingredient.unit)
  )) && value.instructions.every(isString);
}

function readableError(response: Response, defaultMessage: string) {
  return response.text()
    .then((body) => `${defaultMessage}${body ? `: ${body.slice(0, 300)}` : ''}`)
    .catch(() => defaultMessage);
}

// cobalt's public instance (api.cobalt.tools) explicitly disallows third-party
// use without permission, so this always points at a self-hosted instance
// (see cobalt/docker-compose.yml). Current cobalt (v10+) responds with
// { status, url, filename } rather than a bare { url } — this parses that
// contract, not the older /api/json shape.
async function downloadAudio(sourceUrl: string): Promise<ArrayBuffer> {
  const cobaltApiUrl = process.env.COBALT_API_URL;
  if (!cobaltApiUrl) {
    throw new PipelineError('COBALT_API_URL is not configured');
  }

  const cobaltResponse = await fetch(cobaltApiUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: sourceUrl,
      downloadMode: 'audio',
      audioFormat: 'mp3',
    }),
  });

  let cobaltPayload: unknown;
  try {
    cobaltPayload = await cobaltResponse.json();
  } catch {
    throw new PipelineError(`Failed to download video: cobalt returned a non-JSON response (HTTP ${cobaltResponse.status})`);
  }

  if (!isRecord(cobaltPayload) || !isString(cobaltPayload.status)) {
    throw new PipelineError('Failed to download video: unexpected cobalt response shape');
  }

  if (cobaltPayload.status === 'error') {
    const code = isRecord(cobaltPayload.error) && isString(cobaltPayload.error.code)
      ? cobaltPayload.error.code
      : 'unknown_error';
    throw new PipelineError(`Failed to download video: ${code}`);
  }

  if (cobaltPayload.status !== 'tunnel' && cobaltPayload.status !== 'redirect') {
    throw new PipelineError(`Failed to download video: unsupported cobalt response status "${cobaltPayload.status}"`);
  }

  if (!isString(cobaltPayload.url) || !cobaltPayload.url) {
    throw new PipelineError('Failed to download video: cobalt did not return a stream URL');
  }

  const audioResponse = await fetch(cobaltPayload.url);
  if (!audioResponse.ok) {
    throw new PipelineError(await readableError(audioResponse, 'Failed to download audio stream'));
  }

  return audioResponse.arrayBuffer();
}

async function transcribeAudio(audio: ArrayBuffer): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new PipelineError('GROQ_API_KEY is not configured');
  }

  const formData = new FormData();
  formData.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'reel.mp3');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');

  const transcriptionResponse = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqApiKey}` },
    body: formData,
  });

  if (!transcriptionResponse.ok) {
    throw new PipelineError(await readableError(transcriptionResponse, 'Failed to transcribe audio'));
  }

  const transcriptionPayload: unknown = await transcriptionResponse.json();
  if (!isRecord(transcriptionPayload) || !isString(transcriptionPayload.text) || !transcriptionPayload.text.trim()) {
    throw new PipelineError('Failed to transcribe audio: no transcript was returned');
  }

  return transcriptionPayload.text;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A single retry is enough to ride out a transient 429/5xx or an occasional
// malformed-JSON response without eating too much of the 60s function budget.
async function extractRecipe(transcript: string): Promise<{ draft: RecipeDraft; model: string }> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new PipelineError('OPENAI_API_KEY is not configured');
  }

  let lastError = 'Failed to extract recipe with gpt-4o';

  for (let attempt = 1; attempt <= EXTRACTION_MAX_ATTEMPTS; attempt += 1) {
    const isLastAttempt = attempt === EXTRACTION_MAX_ATTEMPTS;

    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        messages: [
          { role: 'system', content: recipeSystemPrompt },
          { role: 'user', content: `Transcription:\n${transcript}` },
        ],
      }),
    });

    if (!response.ok) {
      lastError = await readableError(response, 'Failed to extract recipe with gpt-4o');
      const isTransient = response.status === 429 || response.status >= 500;
      if (isTransient && !isLastAttempt) {
        await delay(EXTRACTION_RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new PipelineError(lastError);
    }

    const payload: unknown = await response.json();
    const content = isRecord(payload)
      && Array.isArray(payload.choices)
      && isRecord(payload.choices[0])
      && isRecord(payload.choices[0].message)
      ? payload.choices[0].message.content
      : undefined;

    if (!isString(content)) {
      lastError = 'Failed to extract recipe with gpt-4o: no response content';
      if (!isLastAttempt) continue;
      throw new PipelineError(lastError);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      lastError = 'Failed to extract recipe with gpt-4o: invalid recipe JSON';
      if (!isLastAttempt) continue;
      throw new PipelineError(lastError);
    }

    if (!isRecipeDraft(parsed)) {
      lastError = 'Failed to extract recipe with gpt-4o: invalid recipe format';
      if (!isLastAttempt) continue;
      throw new PipelineError(lastError);
    }

    return { draft: parsed, model: 'gpt-4o' };
  }

  throw new PipelineError(lastError);
}

async function getTranscript(sourceUrl: string): Promise<{ transcript: string; usedFallback: boolean }> {
  try {
    const audio = await downloadAudio(sourceUrl);
    const transcript = await transcribeAudio(audio);
    return { transcript, usedFallback: false };
  } catch (error) {
    const fallbackTranscript = DEMO_FALLBACK_TRANSCRIPTS[sourceUrl];
    if (fallbackTranscript) {
      return { transcript: fallbackTranscript, usedFallback: true };
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!isRecord(payload) || !isString(payload.url) || typeof payload.useMock !== 'boolean') {
      throw new PipelineError('Expected a request body with url and useMock');
    }

    const sourceUrl = payload.url.trim();
    if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\//i.test(sourceUrl)) {
      throw new PipelineError('Please provide a valid Instagram reel or post URL');
    }

    if (payload.useMock) {
      return json({ success: true, recipe: mockRecipe, modelUsed: 'mock' });
    }

    const { transcript, usedFallback } = await getTranscript(sourceUrl);
    const { draft, model } = await extractRecipe(transcript);
    const recipe: Recipe = {
      ...draft,
      id: crypto.randomUUID(),
      sourceUrl,
      extractedAt: new Date().toISOString(),
    };

    return json({
      success: true,
      recipe,
      modelUsed: usedFallback ? `${model} (cached transcript fallback)` : model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to extract recipe';
    return json({ success: false, error: message });
  }
}
