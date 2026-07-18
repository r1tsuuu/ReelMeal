# ReelMeal — 4-Hour Hackathon Build Context

**Project:** ReelMeal (Turn cooking videos into step-by-step recipes)  
**Event:** OpenAI Build Week 2026 (Apps for Your Life)  
**Duration:** 4 hours | **Cost:** $0.00 | **Team:** 4 developers  
**Architecture:** Next.js 14 PWA + Vercel Serverless  

---

## 📌 Source of Truth (Canonical Spec)

> **This is the single source of truth for ReelMeal.** It supersedes `DEV_SPECS_WITH_TASKS.txt` (now reduced to a pointer). Where this doc and the code on `main` disagree on a **settled** decision, `main` is authoritative — update this doc to match. Any **new** contract decision (env var, provider, schema change) must update this doc **in the same PR** that introduces it. This is a *contract* (what we agreed to build), not a *status tracker* (what's done / not done) — keep progress out of here.

---

## ⚡ Quick Pitch

> Turn reels into meals. Share a cooking video from Instagram, TikTok, or YouTube → ReelMeal extracts ingredients and step-by-step instructions instantly.

**Key UX Feature:** Native Android share sheet integration. Tap Share in Instagram Reel → ReelMeal appears → tap it → done. No copy-paste.

---

## 👥 Dev Role Assignments

| Role | File | Owner | Skill Level |
|------|------|-------|------------|
| **Dev 1: Pipes** | `src/app/api/extract/route.ts` | Backend/API | Intermediate+ |
| **Dev 2: Shell** | `src/app/page.tsx` + `src/components/RecipeCard.tsx` | Frontend State | Intermediate+ |
| **Dev 3: Hook** | `public/manifest.json`, `src/app/shared/page.tsx` | PWA/Config | Beginner+ |
| **Dev 4: Anchor** | `src/components/KitchenMode.tsx` | UX/Interaction | Beginner+ |

---

## 📁 Repo Structure (Do Not Deviate)

```
reelmeal/
├── public/
│   ├── manifest.json            [Dev 3] PWA config
│   ├── sw.js                    [Dev 3] Service worker
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── types/
│   │   └── recipe.ts            [SHARED] Master interface
│   ├── utils/
│   │   ├── mockData.ts          [SHARED] Static test recipes
│   │   ├── regex.ts             [SHARED] URL sanitization
│   │   └── constants.ts         [SHARED] Magic strings
│   ├── components/
│   │   ├── RecipeCard.tsx       [Dev 2] Recipe list item display
│   │   ├── RecipeModal.tsx      [Dev 2] Full recipe overlay (optional)
│   │   └── KitchenMode.tsx      [Dev 4] Hands-free cooking mode
│   ├── app/
│   │   ├── layout.tsx           [Dev 3] PWA wrapper
│   │   ├── page.tsx             [Dev 2] Main dashboard
│   │   ├── shared/
│   │   │   └── page.tsx         [Dev 3] Web Share Target router
│   │   ├── api/
│   │   │   └── extract/
│   │   │       └── route.ts     [Dev 1] Core LLM pipeline
│   │   └── globals.css          [SHARED] Tailwind setup
├── next.config.js               [SHARED] PWA plugin
├── tailwind.config.js           [SHARED]
├── package.json
├── .env.local                   [SHARED] DO NOT COMMIT
├── .gitignore                   [SHARED] .env.local + node_modules
└── README.md                    [SHARED] Final submission docs
```

**CRITICAL RULE:** Do not create files outside your assigned block. Merge conflicts = team failure in 4 hours.

---

## 🔐 Shared Data Contract

**All developers must build against this exact TypeScript interface.**

**Save to: `src/types/recipe.ts`**

```typescript
export interface Ingredient {
  name: string;
  amount: string;       // "1/2", "3", "to taste"
  unit: string;         // "cup", "tbsp", "grams", ""
}

export interface Recipe {
  id: string;           // Server-generated UUID (set by /api/extract; do not regenerate client-side)
  title: string;
  sourceUrl: string;
  extractedAt: string;  // ISO 8601
  servings: string;     // "2-4" or "4"
  prepTime: string;     // "15 mins"
  cookTime: string;     // "30 mins"
  ingredients: Ingredient[];
  instructions: string[]; // Ordered steps
}

export type LoadingStage = 'idle' | 'fetching_stream' | 'transcribing_audio' | 'parsing_ai' | 'error';

export interface APIRequestPayload {
  url: string;
  useMock: boolean;
}

export interface APIResponsePayload {
  success: boolean;
  recipe?: Recipe;
  error?: string;
  modelUsed?: string;
}
```

---

## 🛠️ Shared Utilities (Copy Immediately)

### 1. Regex URL Cleaner
**Save to: `src/utils/regex.ts`**

```typescript
/**
 * Extracts canonical Instagram Reel URL from messy mobile share text.
 * Handles tracking params, whitespace, and multiple URL formats.
 */
export function extractInstagramUrl(sharedText: string): string | null {
  const urlRegex = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[a-zA-Z0-9_\-]+)/i;
  const match = sharedText.match(urlRegex);
  if (!match) return null;
  return `${match[1].replace(/\/$/, '')}/`; // Clean trailing slash
}

/**
 * Validates URL is valid Instagram format (basic check)
 */
export function isValidInstagramUrl(url: string): boolean {
  return /instagram\.com\/(reel|p)\//.test(url);
}
```

### 2. Mock Test Data
**Save to: `src/utils/mockData.ts`**

```typescript
import { Recipe } from '@/types/recipe';

export const mockRecipe: Recipe = {
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
    { name: 'Sea Salt & Pepper', amount: 'to taste', unit: '' }
  ],
  instructions: [
    'Wash and cut potatoes into halves.',
    'Toss with oil, garlic powder, salt, pepper, and parmesan.',
    'Arrange cut-side down on baking sheet.',
    'Roast at 200°C for 25 minutes until golden and crispy.',
    'Serve hot with crispy cheese edges.'
  ]
};
```

### 3. Constants
**Save to: `src/utils/constants.ts`**

```typescript
export const STORAGE_KEY = 'reelmeal-vault';
export const API_ENDPOINT = '/api/extract';

export const COLORS = {
  terracotta: '#C75B3F',
  cream: '#F5E6D3',
  sage: '#87A878',
  charcoal: '#121212',
};

export const LOADING_MESSAGES = {
  idle: 'Ready to extract recipes',
  fetching_stream: 'Downloading video...',
  transcribing_audio: 'Transcribing audio...',
  parsing_ai: 'Extracting recipe...',
  error: 'Something went wrong',
};
```

---

## 🧑‍💻 Dev 1: Backend Pipeline (Pipes)

**Target File:** `src/app/api/extract/route.ts`

**Your Job:** Ingest Instagram URL → fetch audio via the yt-dlp download service → transcribe with Groq → extract structured recipe with LLM → return clean JSON under 30 seconds.

**Tech Stack:**
- yt-dlp (audio download), hosted as a standalone HTTP service — see the ⚠️ download-layer note below
- Groq Whisper Large v3 (fast transcription)
- OpenRouter free LLMs (primary extraction): `llama-3.3-70b-instruct:free` → `qwen-2.5-72b-instruct:free`, then **GPT-4o** as a paid fallback. The route tries each in order and skips any model whose API key isn't configured.

> **⚠️ Download layer — yt-dlp runs in its own container, NOT inside `route.ts`.** ReelMeal originally used the Cobalt HTTP API, which was **shut down on 2024-11-11** (v7 deprecated — see [imputnet/cobalt#860](https://github.com/imputnet/cobalt/discussions/860)). The replacement is **yt-dlp**, but yt-dlp is a *local CLI binary*, not an HTTP API, so **it cannot run inside Vercel serverless** (Lambda has no yt-dlp binary, a tight deployment-size budget, and unreliable binary execution). **Decision — Path A:** host yt-dlp as a tiny standalone service (Render / Railway / Fly.io free tier) exposing ONE HTTP endpoint that mimics the old Cobalt contract (`POST { url, downloadMode, audioFormat } → { url: <audio stream> }`). Reasons: (1) `route.ts` stays a plain HTTP call — only the endpoint URL changes, so existing code **and tests keep working**; (2) the heavy binary lives off Vercel, so the **live deploy actually works**; (3) it's trivially mockable, same as Cobalt was. The `downloadAudio(sourceUrl) → ArrayBuffer of mp3` contract is unchanged. Dev 1 swaps the old hardcoded Cobalt URL for the `DOWNLOAD_SERVICE_URL` env var.

**Codex Prompt (Copy-Paste This):**

```
Create src/app/api/extract/route.ts as a Next.js 14 App Router route handler.

EXPORTS:
export const maxDuration = 60;  // Vercel Hobby caps serverless at 60s (Pro = 300s)
export const dynamic = 'force-dynamic';

HANDLER LOGIC:
1. POST endpoint accepts: { url: string, useMock: boolean }

2. If useMock === true:
   - Import mockRecipe from @/utils/mockData
   - Return immediately: { success: true, recipe: mockRecipe, modelUsed: 'mock' }

3. If useMock === false:
   - Step A: Call the yt-dlp download service (HTTP endpoint hosted off Vercel — see the ⚠️ note above)
     POST to ${DOWNLOAD_SERVICE_URL}   (e.g. https://reelmeal-dl.onrender.com/api/json)
     Headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
     Body: { "url": "INPUT_URL", "downloadMode": "audio", "audioFormat": "mp3" }
     The service runs yt-dlp and returns Cobalt-compatible JSON: { "url": "<direct audio stream link>" }
     (Same I/O shape as Cobalt → route.ts is unchanged except for the endpoint URL.)
   
   - Step B: Transcribe audio with Groq Whisper
     Fetch the audio stream to ArrayBuffer
     Convert to Blob / File object
     POST to https://api.groq.com/openai/v1/audio/transcriptions
     Headers: { 'Authorization': 'Bearer ${GROQ_API_KEY}' }
     Body: FormData { file: audioBlob, model: 'whisper-large-v3', response_format: 'json' }
     Extract response.text (transcript string)
   
   - Step C: Extract recipe via LLM CASCADE (try in order; skip any model whose key is missing)
       Candidates:
         1. OpenRouter  meta-llama/llama-3.3-70b-instruct:free   (needs OPENROUTER_API_KEY)
         2. OpenRouter  qwen/qwen-2.5-72b-instruct:free           (needs OPENROUTER_API_KEY)
         3. OpenAI      gpt-4o                                     (needs OPENAI_API_KEY — paid fallback)
       For each candidate:
         Endpoint:  OpenRouter → https://openrouter.ai/api/v1/chat/completions
                    OpenAI     → https://api.openai.com/v1/chat/completions
         Headers:   { 'Authorization': 'Bearer ${KEY}', 'Content-Type': 'application/json' }
         Body:      { model, temperature: 0, messages: [ systemPrompt, userPrompt ] }
         System Prompt: "You are a culinary analyst. Extract recipe details from an audio transcription. Return ONLY valid JSON (no markdown fences) matching: {title, servings, prepTime, cookTime, ingredients: [{name, amount, unit}], instructions: [string]}. Use empty strings for unstated values; do not invent."
         User Prompt:   "Transcription:\n[INSERT_TRANSCRIPT]"
         Parse response.choices[0].message.content as STRICT JSON and validate the recipe shape
         On 429 / non-OK / invalid JSON → continue to the next candidate
       Return the first valid recipe + the model string that produced it
   
   - Step D: Validate & return
     Ensure all required fields present
     Add id: crypto.randomUUID()   (server-generated; the frontend uses it as-is)
     Add sourceUrl: INPUT_URL
     Add extractedAt: new Date().toISOString()
     Return: { success: true, recipe: OBJECT, modelUsed: <the model that succeeded> }

4. ERROR HANDLING:
   Wrap all steps in try-catch
   If the download service fails: return { success: false, error: "Failed to download video" }
   If Groq fails: return { success: false, error: "Failed to transcribe audio" }
   If ALL cascade candidates fail: return { success: false, error: "Failed to extract recipe" }
   If JSON parse fails: return { success: false, error: "Invalid recipe format" }
   Return HTTP 200 with error object (not 500) so frontend can handle gracefully

5. PERFORMANCE:
   Total pipeline target: under 30 seconds
   Log timestamps for debugging
   Cache transcripts if possible (optional optimization)
```

**Environment Variables (Add to `.env.local`):**
```
GROQ_API_KEY=your_groq_key_here
OPENROUTER_API_KEY=your_openrouter_key_here   # primary LLM (free models)
OPENAI_API_KEY=your_openai_key_here           # optional paid fallback
DOWNLOAD_SERVICE_URL=https://your-ytdlp-service.onrender.com/api/json   # yt-dlp container (replaces Cobalt)
```

**Testing Checklist:**
- [ ] Mock mode returns mockRecipe instantly
- [ ] Real mode handles 404 URL gracefully
- [ ] JSON parsing doesn't crash on malformed response
- [ ] Response time under 30s (hard ceiling: 60s on Vercel Hobby)
- [ ] Cascade skips a model on 429 / bad JSON and falls through to the next
- [ ] localStorage doesn't blow up with large responses

**Integration Point:**
Dev 2 calls this endpoint via: `fetch('/api/extract', { method: 'POST', body: JSON.stringify({ url, useMock }) })`

---

## 🧑‍💻 Dev 2: Frontend State & Dashboard (Shell)

**Target Files:** `src/app/page.tsx` + `src/components/RecipeCard.tsx` (+ optional `src/components/RecipeModal.tsx`)

**Your Job:** Build dashboard layout, manage React state machine, handle localStorage persistence, read share parameters, orchestrate API calls, render recipe list.

**Tech Stack:**
- React hooks (useState, useEffect, useCallback)
- Next.js App Router (useRouter, useSearchParams)
- Tailwind CSS (color scheme provided)
- localStorage for persistence

**Core State Machine:**

```typescript
// These 4 states control your entire UI
const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
const [stage, setStage] = useState<LoadingStage>('idle');
const [inputUrl, setInputUrl] = useState<string>('');
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [kitchenMode, setKitchenMode] = useState<boolean>(false);
```

**Codex Prompt (Copy-Paste This):**

```
Create src/app/page.tsx as the main dashboard page component using 'use client'.

COMPONENT STRUCTURE:
1. State Management:
   - currentRecipe: Recipe | null (currently viewing)
   - savedRecipes: Recipe[] (all saved locally)
   - stage: LoadingStage (tracks extraction progress)
   - inputUrl: string (form input)
   - errorMessage: string | null
   - kitchenMode: boolean (toggle full-screen mode)

2. Lifecycle (useEffect on mount):
   a) Load 'reelmeal-vault' from localStorage
   b) Parse as Recipe[], set to savedRecipes (handle errors gracefully)
   c) Check URL search params for ?shareUrl=...
   d) If present, set inputUrl to decoded value and auto-trigger extraction

3. Form Submission (handleSubmit):
   a) Validate URL contains 'instagram.com' (basic check)
   b) Set stage to 'fetching_stream', clear errorMessage
   c) Fetch '/api/extract' via POST with { url: inputUrl, useMock: false }
   d) On success — use response.recipe AS-IS (id + extractedAt are server-generated; do NOT regenerate them):
      - DUPLICATE CHECK before saving: look up savedRecipes for an entry whose
        sourceUrl === response.recipe.sourceUrl
          • No match  → unshift the new recipe to the front, persist, reset inputUrl, set stage 'idle'
          • Match found → do NOT auto-save. Show an overwrite dialog:
              Title:  "Recipe already saved"
              Body:   "You saved this recipe on {existing.extractedAt}. Extract it again?"
              Buttons:
                [ Overwrite old ]  → replace the existing entry with the new recipe, persist, close, stage 'idle'
                [ Keep existing ]  → discard the new recipe, close, stage 'idle'
                [ View saved ]     → open the existing recipe in the modal so the user can compare first
      - Persist to localStorage ('reelmeal-vault') after any change
   e) On error:
      - Set stage to 'error'
      - Set errorMessage to response.error
      - Keep inputUrl populated for retry

4. Layout (Render):
   - Hero Input Section (top):
     Input field: "Paste Instagram Reel URL"
     Button: "Extract Recipe" (disabled while stage !== 'idle')
     Loading text: Show LOADING_MESSAGES[stage]
     Error banner: Show errorMessage if stage === 'error' (red background)
     Colors: Button terracotta #C75B3F, input cream #F5E6D3
   
   - Recipe Grid (main):
     Map savedRecipes → <RecipeCard /> components
     Masonry layout (CSS Grid)
     On click: setCurrentRecipe(recipe)
     Background: Cream #F5E6D3
   
   - Recipe Detail Modal (overlay):
     Show if currentRecipe !== null
     Display: title, servings, prep/cook times, full ingredient list (checkboxes), instructions (numbered)
     Buttons: "Kitchen Mode" (toggle), "Close" (setCurrentRecipe(null))
     Optional: "Delete" button (remove from savedRecipes)

5. Recipe Card Component (src/components/RecipeCard.tsx):
   Props: recipe: Recipe, onClick: () => void
   Display: title, image placeholder, servings, cook time, ingredient count
   On click: onClick()
   Styling: Shadow, hover effect, rounded corners

6. Kitchen Mode Trigger:
   When user clicks "Kitchen Mode" button:
   - setCurrentRecipe(null) to close modal
   - setKitchenMode(true)
   - Show <KitchenMode recipe={currentRecipe} onClose={() => setKitchenMode(false)} />

7. Styling Constants:
   Use Tailwind only. Hex colors:
   - Terracotta (action): #C75B3F
   - Cream (background): #F5E6D3
   - Sage (success/secondary): #87A878
   - Charcoal (dark text): #121212

8. Testing:
   Start with useMock: true to test UI without API calls
   Once UI is solid, flip to useMock: false for live extraction
```

**Component Hierarchy:**
```
<Page>
  <div className="input-hero">
    <input url />
    <button onClick={handleSubmit} />
    <LoadingBar stage={stage} />
  </div>
  <div className="recipe-grid">
    {savedRecipes.map(recipe => 
      <RecipeCard recipe={recipe} onClick={() => setCurrentRecipe(recipe)} />
    )}
  </div>
  {currentRecipe && (
    <RecipeModal recipe={currentRecipe} onClose={() => setCurrentRecipe(null)} onKitchenMode={() => setKitchenMode(true)} />
  )}
  {kitchenMode && currentRecipe && (
    <KitchenMode recipe={currentRecipe} onClose={() => setKitchenMode(false)} />
  )}
</Page>
```

**Testing Checklist:**
- [ ] Form input accepts text
- [ ] Mock mode populates grid instantly
- [ ] localStorage persists across refresh
- [ ] ?shareUrl param auto-fills input and triggers submission
- [ ] Loading states display correctly (fetching_stream → transcribing → parsing)
- [ ] Error banner shows on API failure
- [ ] Clicking recipe card opens modal
- [ ] Kitchen Mode button is visible in modal
```

**Integration Points:**
- Calls Dev 1's `/api/extract` endpoint
- Passes recipes to Dev 4's `<KitchenMode />`
- Reads/writes localStorage key: `'reelmeal-vault'`
- Reads search param: `?shareUrl=...` (set by Dev 3)

**Color Reference:**
```css
/* Tailwind custom config (extend theme) */
terracotta: '#C75B3F',
cream: '#F5E6D3',
sage: '#87A878',
charcoal: '#121212'
```

---

## 🧑‍💻 Dev 3: PWA & Native Integration (Hook)

**Target Files:** `public/manifest.json`, `public/sw.js`, `src/app/layout.tsx`, `src/app/shared/page.tsx`

**Your Job:** Make the web app installable, intercept Android's native share sheet, route URLs to the dashboard.

**Tech Stack:**
- PWA manifest + service worker
- Web Share Target API
- Next.js metadata system

### Part 1: Manifest
**Save to: `public/manifest.json`**

```json
{
  "name": "ReelMeal",
  "short_name": "ReelMeal",
  "description": "Extract recipes from cooking videos instantly",
  "theme_color": "#C75B3F",
  "background_color": "#F5E6D3",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "scope": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "share_target": {
    "action": "/shared",
    "method": "GET",
    "params": {
      "text": "text"
    }
  }
}
```

### Part 2: Service Worker
**Save to: `public/sw.js`**

```javascript
const CACHE_NAME = 'reelmeal-v1-core';
const ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
```

### Part 3: Layout PWA Headers
**Update `src/app/layout.tsx`:**

Add to the metadata export object:

```typescript
export const metadata: Metadata = {
  title: 'ReelMeal',
  description: 'Extract recipes from cooking videos instantly',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ReelMeal',
  },
  themeColor: '#C75B3F',
  icons: [
    { rel: 'icon', url: '/icon-192.png', sizes: '192x192' },
    { rel: 'apple-touch-icon', url: '/icon-192.png' },
  ],
};

// In JSX <head> (Next.js 14 handles this via metadata, but ensure it's there)
```

Also add service worker registration script in layout's `<body>` section (end of JSX):

```typescript
{typeof window !== 'undefined' && (
  <script>
    {`if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }`}
  </script>
)}
```

### Part 4: Share Target Router
**Save to: `src/app/shared/page.tsx`**

```typescript
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { extractInstagramUrl } from '@/utils/regex';

export default function SharedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sharedText = searchParams.get('text');

    if (!sharedText) {
      router.replace('/');
      return;
    }

    // Extract clean URL from messy share payload
    const cleanedUrl = extractInstagramUrl(sharedText);

    if (!cleanedUrl) {
      // Invalid URL, go home with error flag
      router.replace('/?error=invalid_link');
      return;
    }

    // Route back to dashboard with pre-filled URL
    router.replace(`/?shareUrl=${encodeURIComponent(cleanedUrl)}`);
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <p className="text-charcoal">Processing share...</p>
    </div>
  );
}
```

**Testing Checklist:**
- [ ] Manifest.json is served correctly (check DevTools → Application → Manifest)
- [ ] App is installable on mobile (Android: "Install app")
- [ ] Share Target registered (share any text to test, app appears in share sheet)
- [ ] Clicking share in IG redirects to /?shareUrl=...
- [ ] Service worker registered (DevTools → Application → Service Workers)

**Integration Points:**
- Android share sheet → `/shared?text=...` → regex clean → redirect to `/?shareUrl=...`
- Dev 2 reads `?shareUrl=...` on dashboard mount

---

## 🧑‍💻 Dev 4: Kitchen Mode (Hands-Free UX) (Anchor)

**Target File:** `src/components/KitchenMode.tsx`

**Your Job:** Full-screen, hands-free cooking interface with zero-dim lock, massive text, volume key navigation.

**Tech Stack:**
- React hooks (useState, useEffect)
- Web Wake Lock API
- CSS Grid / Tailwind
- Keyboard event listeners

**Codex Prompt (Copy-Paste This):**

```
Create src/components/KitchenMode.tsx as a React client component ('use client').

PROPS:
interface KitchenModeProps {
  recipe: Recipe;
  onClose: () => void;
}

STATE:
- stepIndex: number (0-indexed step position)

LIFECYCLE:
1. On Mount:
   a) Request Wake Lock to prevent screen dimming:
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        // Store in ref for cleanup
      }
   b) Add keyboard event listener for volume/arrow key navigation
   c) Set document.body.overflow = 'hidden' (prevent scroll)

2. On Unmount:
   a) Release wake lock: lock.release()
   b) Remove keyboard listener
   c) Restore document.body.overflow

KEYBOARD BINDINGS:
- ArrowRight or VolumeUp → setStepIndex(prev => Math.min(prev + 1, recipe.instructions.length - 1))
- ArrowLeft or VolumeDown → setStepIndex(prev => Math.max(prev - 1, 0))

RENDER LAYOUT (Full Screen, Dark Theme):
- Background: Charcoal #121212 (full viewport)
- Text: White (#FFFFFF)
- No scrolling, no navigation

- Top Section: Progress indicator
  "Step X of Y" (large, centered)
  Example: "Step 3 of 7"
  Font size: 1.5rem, color: sage #87A878

- Middle Section: Instruction Display
  Show recipe.instructions[stepIndex]
  Font size: 3rem+ (HUGE for kitchen visibility)
  Font weight: 600
  Center aligned
  Padding: 3rem
  Line height: 1.5 (breathing room)

- Touch Navigation (Invisible Split Hit Zones):
  Left 50% of screen: onClick → decrease stepIndex
  Right 50% of screen: onClick → increase stepIndex
  Each zone should be cursor: pointer on hover

- Bottom Section: Recipe Overview (Optional)
  Small text list of remaining ingredients
  or progress bar showing step position
  Opacity: 0.6 (subtle, not distracting)

ACCESSIBILITY:
- Large touch targets (full half of screen)
- High contrast (white text on black)
- No animations or flashing
- Simple, focused UI

STYLING:
- Use Tailwind + custom CSS for 100vh viewport
- No margins/padding constraints, use full space
- Font: system-ui or sans-serif
```

**Component Shell (to get you started):**

```typescript
'use client';

import { Recipe } from '@/types/recipe';
import { useEffect, useRef, useState } from 'react';

interface KitchenModeProps {
  recipe: Recipe;
  onClose: () => void;
}

export default function KitchenMode({ recipe, onClose }: KitchenModeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    // Request wake lock
    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then(lock => {
          wakeLockRef.current = lock;
        })
        .catch(() => console.warn('Wake lock unavailable'));
    }

    // Keyboard listener
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'VolumeUp') {
        e.preventDefault();
        setStepIndex(prev => Math.min(prev + 1, recipe.instructions.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'VolumeDown') {
        e.preventDefault();
        setStepIndex(prev => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = 'unset';
      wakeLockRef.current?.release();
    };
  }, [recipe]);

  const currentInstruction = recipe.instructions[stepIndex] || '';
  const totalSteps = recipe.instructions.length;

  return (
    <div className="fixed inset-0 bg-charcoal text-white flex flex-col justify-between overflow-hidden">
      {/* Top: Step Counter */}
      <div className="text-center pt-8 text-sage text-3xl font-bold">
        Step {stepIndex + 1} of {totalSteps}
      </div>

      {/* Middle: Instruction Display */}
      <div className="flex-1 flex items-center justify-center px-8">
        <p className="text-6xl font-bold text-center leading-relaxed">
          {currentInstruction}
        </p>
      </div>

      {/* Touch Navigation Zones */}
      <div className="flex absolute inset-0 pointer-events-none">
        <div
          className="w-1/2 cursor-pointer pointer-events-auto"
          onClick={() => setStepIndex(prev => Math.max(prev - 1, 0))}
        />
        <div
          className="w-1/2 cursor-pointer pointer-events-auto"
          onClick={() => setStepIndex(prev => Math.min(prev + 1, totalSteps - 1))}
        />
      </div>

      {/* Bottom: Progress Bar */}
      <div className="w-full h-2 bg-sage/30 mb-8">
        <div
          className="h-full bg-sage transition-all"
          style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Close Button (subtle, top-right) */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl"
      >
        ✕
      </button>
    </div>
  );
}
```

**Testing Checklist:**
- [ ] Component renders full screen (no scroll)
- [ ] Wake lock doesn't throw errors
- [ ] Arrow keys advance/rewind steps
- [ ] Touch zones work (click left half = prev, right half = next)
- [ ] Font size readable from 2 feet away
- [ ] Close button exits kitchen mode

**Integration Point:**
Dev 2 calls this via: `<KitchenMode recipe={currentRecipe} onClose={() => setKitchenMode(false)} />`

---

## 🎯 Configuration Files

### `next.config.js`
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Optional: disable in dev
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
```

### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: '#C75B3F',
        cream: '#F5E6D3',
        sage: '#87A878',
        charcoal: '#121212',
      },
    },
  },
  plugins: [],
};
```

### `package.json` (dependencies)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next-pwa": "^5.6.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0"
  }
}
```

### `.env.local` (DO NOT COMMIT)
```
GROQ_API_KEY=gsk_your_groq_key_here
OPENROUTER_API_KEY=sk-or-your_openrouter_key_here
OPENAI_API_KEY=sk-your_openai_key_here
DOWNLOAD_SERVICE_URL=https://your-ytdlp-service.onrender.com/api/json
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `.gitignore`
```
node_modules/
.env.local
.env.*.local
.next/
out/
dist/
build/
*.pem
.DS_Store
```

---

## 🏗️ Integration Timeline (Final Hour)

### Hour 3:00 - Merge Checkpoints

**Checkpoint 1: Dev 3 Merges PWA (10 min)**
```bash
git add public/manifest.json public/sw.js src/app/layout.tsx src/app/shared/page.tsx
git commit -m "feat: PWA + Web Share Target integration"
```
Test: Open in mobile browser, check "Add to Home Screen" available

**Checkpoint 2: Dev 2 Merges Dashboard (10 min)**
```bash
git add src/app/page.tsx src/components/RecipeCard.tsx src/types/recipe.ts src/utils/
git commit -m "feat: Dashboard + state management + localStorage"
```
Test: Form accepts URL, mock mode works, grid populates

**Checkpoint 3: Dev 4 Merges Kitchen Mode (10 min)**
```bash
git add src/components/KitchenMode.tsx
git commit -m "feat: Hands-free kitchen mode with wake lock"
```
Test: Click "Kitchen Mode" on card, verify full screen, test arrow keys

**Checkpoint 4: Dev 1 Goes Live (15 min)**
```bash
git add src/app/api/extract/route.ts .env.local
git commit -m "feat: API pipeline - yt-dlp download service + Groq + OpenRouter"
```
Deploy to Vercel: `vercel deploy --prod`

### Hour 3:45 - Live Integration Test

**Run this sequence:**
1. All devs pull latest code
2. Start local dev server: `npm run dev`
3. Open http://localhost:3000 in desktop browser
4. Test form with useMock: true (should return mockRecipe)
5. Flip useMock: false
6. Open on mobile device
7. Share real Instagram Reel from IG app
8. Verify full pipeline: URL → API → recipe card → localStorage
9. Click recipe, toggle Kitchen Mode, test navigation

### Hour 3:50 - Record Demo

**Capture 2-3 minute video showing:**
- Share from Instagram Reel → app opens with URL pre-filled
- Recipe extraction in progress (loading states)
- Recipe card displays with ingredients + instructions
- Toggle Kitchen Mode, show step navigation
- Mention: "Built with Codex + GPT-5.6 (dev) | Groq + OpenRouter free models (runtime), OpenAI fallback"

### Hour 4:00 - Submit

- [ ] Vercel live URL (test it works)
- [ ] GitHub repo public, README filled
- [ ] .env.local NOT in git, listed in .gitignore
- [ ] Demo video linked or embedded in README
- [ ] `/feedback` session ID from Codex documented

---

## 🚨 Failure Modes & Fixes

| Problem | Fix |
|---------|-----|
| yt-dlp service down / rate-limited | Retry with backoff (3s, 6s, 12s); for the demo, pre-cache 2-3 transcripted reels |
| Instagram blocks the download (auth wall) | yt-dlp may need cookies/login; fall back to a cached demo reel |
| Groq Whisper times out | Pre-extract 2-3 demo reels, cache in localStorage |
| Pipeline exceeds 60s (Vercel Hobby cap) | Trim the cascade to fewer models, cache transcripts, or upgrade to Pro (300s) |
| OpenRouter / OpenAI key invalid | Cascade skips the bad provider and falls through to the next; verify key + billing in the Vercel dashboard |
| localStorage full | Limit savedRecipes to last 20 items, implement pagination |
| Wake Lock denied | Graceful fallback (not critical for demo) |
| Instagram URL extraction fails | Test regex separately, add multiple URL pattern variants |
| Vercel deployment fails | Check build logs, ensure .env vars are set in Vercel dashboard |

---

## 📋 Quick Reference

### Key Files by Role
```
Dev 1: src/app/api/extract/route.ts
Dev 2: src/app/page.tsx + src/components/RecipeCard.tsx
Dev 3: public/manifest.json + src/app/shared/page.tsx
Dev 4: src/components/KitchenMode.tsx
```

### Shared Files (All Devs Reference)
```
src/types/recipe.ts        ← Define this first
src/utils/regex.ts         ← Define this second
src/utils/mockData.ts      ← Define this third
src/utils/constants.ts     ← Define this fourth
```

### Storage Key
```
localStorage: 'reelmeal-vault'
Format: JSON.stringify(Recipe[])
```

### API Endpoint
```
POST /api/extract
Input: { url: string, useMock: boolean }
Output: { success: boolean, recipe?: Recipe, error?: string }
```

### Environment Variables
```
GROQ_API_KEY=...
OPENROUTER_API_KEY=...   # primary LLM
OPENAI_API_KEY=...        # optional paid fallback
DOWNLOAD_SERVICE_URL=...  # yt-dlp container (replaces Cobalt)
NEXT_PUBLIC_APP_URL=... (optional, for debugging)
```

### Colors
```
Terracotta: #C75B3F (primary action)
Cream:      #F5E6D3 (background)
Sage:       #87A878 (secondary/success)
Charcoal:   #121212 (dark text/kitchen mode bg)
```

---

## 🎯 Success Criteria (End of 4 Hours)

✅ Web app deployed to Vercel and accessible via live URL  
✅ Android Share Sheet integration working (real Instagram share → app opens with URL)  
✅ Recipes extract correctly from Groq Whisper + OpenAI  
✅ Kitchen Mode toggle works, full screen, step navigation responsive  
✅ localStorage persists recipes across page refreshes  
✅ 2-3 min demo video recorded and linked  
✅ README explains "Codex + GPT-5.6 (dev) | Groq + OpenRouter free models (runtime), OpenAI fallback"  
✅ GitHub repo public, .env.local in .gitignore  

---

**You're ready to start. Pick your team roles, grab your API keys, and open Codex. Go.**
