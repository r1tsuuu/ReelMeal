# ReelMeal

ReelMeal turns a cooking video into a clean, structured recipe. Paste a link or share it from your phone, and the app pulls out the ingredients and the steps so you can cook from it instead of scrubbing through a video.

## What it does

You give ReelMeal a cooking reel. It downloads the audio, transcribes the speech, and asks a language model to return the dish as a recipe: a title, servings, prep and cook times, a list of ingredients with amounts and units, and numbered instructions. The result lands in your Vault, a personal collection that lives in your browser and persists between visits.

The quickest path is the share sheet. From Instagram, open Share and pick ReelMeal. The app opens with the link already filled in and starts extracting right away. You can also paste a URL inside the app.

The extraction pipeline currently handles Instagram reels. The interface shows source badges for Instagram, TikTok, YouTube, and the web so the origin of a link is always clear.

## Features

- **Recipe Vault.** Saved recipes stay in your browser through localStorage. Search by title or tag, switch between a grid and a list, and filter with chips for All, Recently Saved, and any tag in your Vault.
- **Collections.** Group recipes into named collections. A default Saved collection is always present, and you can create new ones inline. Long-press a card to file a recipe into a collection.
- **Reading view.** A recipe opens in a focused sheet with two tabs. Check off ingredients as you prep, then move to the steps. Servings, prep, and cook times sit at the top.
- **Kitchen Mode.** A full-screen, hands-free cooking view that keeps the screen awake, shows large step text, and moves between steps with a tap or the arrow keys. A progress bar tracks where you are.
- **Add a recipe.** An in-app sheet takes a URL and shows progress while it runs. If a recipe is already in your Vault, a banner points you to the saved copy instead of creating a duplicate.
- **Delete with care.** Removing a recipe asks for confirmation first, then offers an undo in case you change your mind.
- **Installable and shareable.** ReelMeal is a Progressive Web App. Install it to your home screen and share reels into it straight from Instagram.

## How it works

The backend is a Next.js route handler at /api/extract.

1. The link is validated and the audio is downloaded with yt-dlp, with ffmpeg available for processing.
2. The audio is transcribed with Groq Whisper.
3. The transcript is sent to GPT-4o, which returns the recipe as strict JSON.
4. If the transcript does not yield a recipe, six frames are pulled from the video and sent to GPT-4o with a vision prompt as a fallback.

Temporary media is cleaned up after each run.

## Tech stack

- Next.js 14 with the App Router, React 18, and TypeScript
- Tailwind CSS with a custom palette of cream, charcoal, terracotta, and sage
- Framer Motion for animation, lucide-react for icons, and Sonner for toasts
- Fraunces and Inter for typography
- next-pwa for the service worker and offline support

## Getting started

You need two API keys, one from Groq for transcription and one from OpenAI for extraction. Copy `.env.example` to `.env.local` and add your keys.

```
GROQ_API_KEY=your-key
OPENAI_API_KEY=your-key
```

Install the dependencies and start the dev server.

```
npm install
npm run dev
```

Set `NEXT_PUBLIC_USE_MOCK=true` to skip the network and use a built-in sample recipe. Run the tests with Node's built-in runner through tsx.

```
npm test
```
