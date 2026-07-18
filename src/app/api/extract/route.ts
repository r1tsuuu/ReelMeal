import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dependencies } from './dependencies';
import { DEMO_FALLBACK_TRANSCRIPTS } from '@/utils/demoFallbacks';
import type { Recipe } from '@/types/recipe';

// Vercel Hobby plan caps serverless functions at 60s (not 300s, which needs
// Pro). Retries/fallbacks below are trimmed to fit worst-case runs in that budget.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// The model produces everything except identity/save-state fields — those are
// assigned once the draft comes back (collections/savedAt always start empty;
// a freshly extracted recipe hasn't been organized into anything yet).
type RecipeDraft = Omit<Recipe, 'id' | 'sourceUrl' | 'extractedAt' | 'collections' | 'savedAt'>;

const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const EXTRACTION_MAX_ATTEMPTS = 2;
const EXTRACTION_RETRY_DELAY_MS = 1500;

// Vision fallback: one frame every 8s, capped at 6 frames, downscaled to keep
// the OpenAI request payload (and its 60s-budget impact) reasonable.
const FRAME_COUNT = 6;
const FRAME_INTERVAL_SECONDS = 8;
const FRAME_WIDTH = 512;

const RECIPE_JSON_SCHEMA = '{"title":"string","servings":"string","prepTime":"string","cookTime":"string","ingredients":[{"name":"string","amount":"string","unit":"string"}],"instructions":["string"],"tags":["string"]}';

const TEXT_ONLY_SYSTEM_PROMPT = [
  'You are a meticulous culinary analyst extracting a structured recipe from an audio',
  'transcription of a cooking video, plus its caption if provided.',
  '',
  'Before writing the final JSON, work through the transcript and caption carefully:',
  '- List every ingredient actually mentioned, with its exact stated amount and unit.',
  'Do not merge distinct ingredients into one entry, do not drop one that is only',
  'mentioned in passing, and do not add an ingredient that is never mentioned.',
  '- List every distinct cooking action in the order it happens, as separate steps.',
  'Do not combine multiple actions into one step, and do not add a step that is not',
  'actually described.',
  '- The title must specifically name the actual dish being made (e.g. "Garlic Butter',
  'Shrimp Pasta"), never a generic phrase like "Recipe" or "Cooking Video", and never a',
  'copy of marketing text, hashtags, emoji, or calls-to-action from the caption.',
  '- Cross-check your own output before returning it: every ingredient referenced in an',
  'instruction step must appear in the ingredients list, and every listed ingredient must',
  'be used by at least one instruction step. Fix any mismatch before finalizing.',
  '',
  `Return ONLY valid JSON with no markdown or code fences. Use exactly this schema: ${RECIPE_JSON_SCHEMA}`,
  '',
  'Rules for each field:',
  '- amount/unit: use the exact figure stated (e.g. "2", "1/2", "to taste"). Never invent',
  'a specific number that was not actually said — use "to taste" or an empty string',
  'instead of guessing a plausible-sounding quantity.',
  '- servings/prepTime/cookTime: use an empty string if genuinely never stated. Do not',
  'estimate or round to a "typical" value for the dish.',
  '- tags: 1-4 short descriptive labels (main ingredient, cuisine, or cooking method,',
  'e.g. "Chicken", "Quick", "Oven-baked") — use an empty array if nothing fits.',
  '- If the transcript has no real recipe content (e.g. it is song lyrics or unrelated',
  'chatter), return empty strings and empty arrays rather than fabricating a',
  'plausible-sounding recipe from the caption alone.',
].join(' ');

const VISION_SYSTEM_PROMPT = [
  'You are a meticulous culinary analyst. The audio transcript and caption for this',
  'cooking video do not contain enough spoken or written detail to extract a recipe on',
  'their own — you are also given several frames sampled across the video. Use them to',
  'reconstruct the recipe visually.',
  '',
  'Before writing the final JSON, work through the frames carefully and in order:',
  '- Identify every ingredient actually visible (in bowls, packaging, labels, or being',
  'added to the dish) — do not invent an ingredient that never appears in any frame, the',
  'caption, or the transcript.',
  '- Identify every distinct cooking action visible across the frames, in the order it',
  'happens (e.g. marinating, searing, baking, slicing), as separate steps.',
  '- Read any on-screen text overlays for their exact wording (titles, calorie counts,',
  'step labels) and prefer that wording over your own guess.',
  '- The title must specifically name the actual dish shown, never a generic phrase, and',
  'never a copy of marketing text, hashtags, emoji, or calls-to-action from the caption.',
  '- Cross-check your own output before returning it: every ingredient referenced in an',
  'instruction step must appear in the ingredients list, and every listed ingredient must',
  'be used by at least one instruction step. Fix any mismatch before finalizing.',
  '',
  `Return ONLY valid JSON with no markdown or code fences. Use exactly this schema: ${RECIPE_JSON_SCHEMA}`,
  '',
  'Rules for each field:',
  '- amount/unit: exact quantities are rarely stated when relying on visuals, so give',
  'your best reasonable estimate grounded in what is actually shown (visible portion',
  'size, container size) rather than leaving it empty — but do not state a suspiciously',
  'precise figure (e.g. "127g") that the frames could not actually support.',
  '- servings/prepTime/cookTime: give a reasonable estimate grounded in what is shown',
  '(oven dial, visible portions, on-screen timer) rather than leaving it empty, unless',
  'there is truly nothing in any frame, the caption, or the transcript to go on.',
  '- tags: 1-4 short descriptive labels (main ingredient, cuisine, or cooking method,',
  'e.g. "Chicken", "Quick", "Oven-baked") — use an empty array if nothing fits.',
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
  tags: ['Potato', 'Vegetarian', 'Oven-baked'],
  collections: [],
  savedAt: null,
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

  if (!Array.isArray(value.ingredients) || !Array.isArray(value.instructions) || !Array.isArray(value.tags)) {
    return false;
  }

  return value.ingredients.every((ingredient) => (
    isRecord(ingredient)
    && isString(ingredient.name)
    && isString(ingredient.amount)
    && isString(ingredient.unit)
  )) && value.instructions.every(isString) && value.tags.every(isString);
}

// A shape-valid draft can still be a correctly-empty non-answer — e.g. a
// transcript that's song lyrics with no recipe content produces a draft that
// passes isRecipeDraft() but has nothing in it. That's a signal to fall back
// (to cached transcript / vision), not a usable result.
function isUsefulDraft(draft: RecipeDraft): boolean {
  return draft.title.trim().length > 0
    && draft.ingredients.length > 0
    && draft.instructions.length > 0;
}

function readableError(response: Response, defaultMessage: string) {
  return response.text()
    .then((body) => `${defaultMessage}${body ? `: ${body.slice(0, 300)}` : ''}`)
    .catch(() => defaultMessage);
}

function describeSubprocessError(error: unknown, defaultMessage: string): string {
  if (isRecord(error)) {
    const detail = isString(error.stderr) && error.stderr.trim()
      ? error.stderr
      : (isString(error.shortMessage) ? error.shortMessage : undefined)
        ?? (isString(error.message) ? error.message : undefined);
    if (detail) return `${defaultMessage}: ${detail.slice(0, 300)}`;
  }
  return defaultMessage;
}

type DownloadedMedia = {
  workdir: string;
  audioPath: string;
  videoPath: string | null;
  caption: string;
};

// Downloads via yt-dlp instead of a hosted media-downloading API: cobalt's
// public instance explicitly disallows third-party use, and self-hosting it
// just to re-solve what yt-dlp already solves added a whole extra service.
// keepVideo is only requested for the vision fallback, so the fast/common
// path stays audio-only.
async function downloadMedia(sourceUrl: string, { keepVideo }: { keepVideo: boolean }): Promise<DownloadedMedia> {
  if (!dependencies.ffmpegPath) {
    throw new PipelineError('ffmpeg binary is not available in this environment');
  }

  const workdir = await dependencies.mkdtemp(path.join(tmpdir(), 'reelmeal-'));
  const outputTemplate = path.join(workdir, 'media.%(ext)s');

  try {
    await dependencies.youtubedl(sourceUrl, {
      output: outputTemplate,
      extractAudio: true,
      audioFormat: 'mp3',
      writeInfoJson: true,
      noPlaylist: true,
      noWarnings: true,
      ffmpegLocation: dependencies.ffmpegPath,
      ...(keepVideo ? { keepVideo: true } : {}),
    });
  } catch (error) {
    throw new PipelineError(describeSubprocessError(error, 'Failed to download video'));
  }

  let caption = '';
  try {
    const infoRaw = await dependencies.readFile(path.join(workdir, 'media.info.json'), 'utf-8');
    const info: unknown = JSON.parse(infoRaw);
    if (isRecord(info) && isString(info.description)) {
      caption = info.description;
    }
  } catch {
    // Caption is a nice-to-have for extraction context — not fatal if missing.
  }

  return {
    workdir,
    audioPath: path.join(workdir, 'media.mp3'),
    videoPath: keepVideo ? path.join(workdir, 'media.mp4') : null,
    caption,
  };
}

async function transcribeAudio(audioPath: string): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new PipelineError('GROQ_API_KEY is not configured');
  }

  const audioBuffer = await dependencies.readFile(audioPath);

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'reel.mp3');
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

async function extractFrames(videoPath: string, workdir: string): Promise<string[]> {
  if (!dependencies.ffmpegPath) {
    throw new PipelineError('ffmpeg binary is not available in this environment');
  }

  const outputTemplate = path.join(workdir, 'frame_%02d.jpg');

  try {
    await dependencies.execFileAsync(dependencies.ffmpegPath, [
      '-y',
      '-i', videoPath,
      '-vf', `fps=1/${FRAME_INTERVAL_SECONDS},scale=${FRAME_WIDTH}:-2`,
      '-frames:v', String(FRAME_COUNT),
      '-q:v', '4',
      outputTemplate,
    ]);
  } catch (error) {
    throw new PipelineError(describeSubprocessError(error, 'Failed to extract video frames'));
  }

  const frames: string[] = [];
  for (let i = 1; i <= FRAME_COUNT; i += 1) {
    const framePath = path.join(workdir, `frame_${String(i).padStart(2, '0')}.jpg`);
    try {
      await dependencies.readFile(framePath);
      frames.push(framePath);
    } catch {
      break; // fewer frames exist than FRAME_COUNT for short videos — stop at the last real one
    }
  }

  if (frames.length === 0) {
    throw new PipelineError('Failed to extract video frames: no frames were produced');
  }

  return frames;
}

async function frameToDataUri(framePath: string): Promise<string> {
  const bytes = await dependencies.readFile(framePath);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ChatMessage = {
  role: 'system' | 'user';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
};

// A single retry is enough to ride out a transient 429/5xx or an occasional
// malformed-JSON response without eating too much of the 60s function budget.
// Shared by both the text-only and vision extraction calls — only the
// `messages` content differs between them.
async function callExtractionModel(messages: ChatMessage[]): Promise<RecipeDraft> {
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
        messages,
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

    if (!isUsefulDraft(parsed)) {
      lastError = 'Failed to extract recipe with gpt-4o: model returned an empty recipe';
      if (!isLastAttempt) continue;
      throw new PipelineError(lastError);
    }

    return parsed;
  }

  throw new PipelineError(lastError);
}

function extractRecipeFromText(transcript: string, caption: string): Promise<RecipeDraft> {
  return callExtractionModel([
    { role: 'system', content: TEXT_ONLY_SYSTEM_PROMPT },
    { role: 'user', content: `Transcription:\n${transcript}\n\nCaption:\n${caption || '(none)'}` },
  ]);
}

function extractRecipeFromVideo(transcript: string, caption: string, frameDataUris: string[]): Promise<RecipeDraft> {
  return callExtractionModel([
    { role: 'system', content: VISION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Transcription:\n${transcript || '(none)'}\n\nCaption:\n${caption || '(none)'}` },
        ...frameDataUris.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ],
    },
  ]);
}

async function getTranscriptAndCaption(sourceUrl: string): Promise<{ transcript: string; caption: string; usedFallback: boolean; workdir: string | null }> {
  try {
    const media = await downloadMedia(sourceUrl, { keepVideo: false });
    const transcript = await transcribeAudio(media.audioPath);
    return { transcript, caption: media.caption, usedFallback: false, workdir: media.workdir };
  } catch (error) {
    const fallbackTranscript = DEMO_FALLBACK_TRANSCRIPTS[sourceUrl];
    if (fallbackTranscript) {
      return { transcript: fallbackTranscript, caption: '', usedFallback: true, workdir: null };
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const workdirsToClean: string[] = [];

  try {
    const payload: unknown = await request.json();
    if (!isRecord(payload) || !isString(payload.url) || typeof payload.useMock !== 'boolean') {
      throw new PipelineError('Expected a request body with url and useMock');
    }

    const sourceUrl = payload.url.trim();
    if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reels?|p)\//i.test(sourceUrl)) {
      throw new PipelineError('Please provide a valid Instagram reel or post URL');
    }

    if (payload.useMock) {
      return json({ success: true, recipe: mockRecipe, modelUsed: 'mock' });
    }

    const { transcript, caption, usedFallback, workdir } = await getTranscriptAndCaption(sourceUrl);
    if (workdir) workdirsToClean.push(workdir);

    let draft: RecipeDraft;
    let modelTag: string;

    try {
      draft = await extractRecipeFromText(transcript, caption);
      modelTag = usedFallback ? 'gpt-4o (cached transcript fallback)' : 'gpt-4o';
    } catch (textExtractionError) {
      // Transcript (and caption) didn't have enough to work with — fall back
      // to sampling video frames and reasoning over them visually instead.
      const media = await downloadMedia(sourceUrl, { keepVideo: true });
      workdirsToClean.push(media.workdir);

      if (!media.videoPath) {
        throw textExtractionError;
      }

      const frames = await extractFrames(media.videoPath, media.workdir);
      const frameDataUris = await Promise.all(frames.map(frameToDataUri));

      draft = await extractRecipeFromVideo(transcript, media.caption || caption, frameDataUris);
      modelTag = usedFallback ? 'gpt-4o (cached transcript + vision fallback)' : 'gpt-4o (vision fallback)';
    }

    const recipe: Recipe = {
      ...draft,
      id: randomUUID(),
      sourceUrl,
      extractedAt: new Date().toISOString(),
      collections: [],
      savedAt: null,
    };

    return json({ success: true, recipe, modelUsed: modelTag });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to extract recipe';
    return json({ success: false, error: message });
  } finally {
    await Promise.all(workdirsToClean.map((dir) => dependencies.rm(dir, { recursive: true, force: true }).catch(() => {})));
  }
}
