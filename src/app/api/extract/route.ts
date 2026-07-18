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

type ModelCandidate = {
  provider: 'openrouter' | 'openai';
  model: string;
};

const COBALT_ENDPOINT = 'https://api.cobalt.tools/api/json';
const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const modelCandidates: ModelCandidate[] = [
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
  { provider: 'openai', model: 'gpt-4o' },
];

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

async function downloadAudio(sourceUrl: string): Promise<ArrayBuffer> {
  const cobaltResponse = await fetch(COBALT_ENDPOINT, {
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

  if (!cobaltResponse.ok) {
    throw new PipelineError(await readableError(cobaltResponse, 'Failed to download video'));
  }

  const cobaltPayload: unknown = await cobaltResponse.json();
  if (!isRecord(cobaltPayload) || !isString(cobaltPayload.url) || !cobaltPayload.url) {
    throw new PipelineError('Failed to download video: Cobalt did not return an audio stream');
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

function apiKeyFor(candidate: ModelCandidate): string | undefined {
  return candidate.provider === 'openrouter'
    ? process.env.OPENROUTER_API_KEY
    : process.env.OPENAI_API_KEY;
}

function endpointFor(candidate: ModelCandidate): string {
  return candidate.provider === 'openrouter' ? OPENROUTER_CHAT_ENDPOINT : OPENAI_CHAT_ENDPOINT;
}

async function extractRecipe(transcript: string): Promise<{ draft: RecipeDraft; model: string }> {
  let lastError = 'Failed to extract recipe';
  let configuredModelFound = false;

  for (const candidate of modelCandidates) {
    const apiKey = apiKeyFor(candidate);
    if (!apiKey) continue;
    configuredModelFound = true;

    try {
      const response = await fetch(endpointFor(candidate), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: candidate.model,
          temperature: 0,
          messages: [
            { role: 'system', content: recipeSystemPrompt },
            { role: 'user', content: `Transcription:\n${transcript}` },
          ],
        }),
      });

      if (!response.ok) {
        lastError = await readableError(response, `Failed to extract recipe with ${candidate.model}`);
        continue;
      }

      const payload: unknown = await response.json();
      const content = isRecord(payload)
        && Array.isArray(payload.choices)
        && isRecord(payload.choices[0])
        && isRecord(payload.choices[0].message)
        ? payload.choices[0].message.content
        : undefined;

      if (!isString(content)) {
        lastError = `Failed to extract recipe with ${candidate.model}: no response content`;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        lastError = `Failed to extract recipe with ${candidate.model}: invalid recipe JSON`;
        continue;
      }

      if (!isRecipeDraft(parsed)) {
        lastError = `Failed to extract recipe with ${candidate.model}: invalid recipe format`;
        continue;
      }

      return { draft: parsed, model: candidate.model };
    } catch (error) {
      lastError = error instanceof Error ? error.message : `Failed to extract recipe with ${candidate.model}`;
    }
  }

  if (!configuredModelFound) {
    throw new PipelineError('OPENROUTER_API_KEY or OPENAI_API_KEY is not configured');
  }

  throw new PipelineError(lastError);
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

    const audio = await downloadAudio(sourceUrl);
    const transcript = await transcribeAudio(audio);
    const { draft, model } = await extractRecipe(transcript);
    const recipe: Recipe = {
      ...draft,
      id: crypto.randomUUID(),
      sourceUrl,
      extractedAt: new Date().toISOString(),
    };

    return json({ success: true, recipe, modelUsed: model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to extract recipe';
    return json({ success: false, error: message });
  }
}
