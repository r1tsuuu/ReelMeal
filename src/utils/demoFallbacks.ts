// Safety net for the live demo: if cobalt or Whisper fails for one of the
// specific reels chosen ahead of time for the demo, extraction falls back to
// a transcript captured during rehearsal instead of failing outright.
// GPT-4o extraction still runs live against this transcript.
//
// To populate: run a real (non-mock) extraction against your chosen demo
// reel(s) once beforehand, copy the transcript Groq returned (temporarily
// log it in transcribeAudio, or check your terminal/Vercel function logs),
// and add it here keyed by the exact source URL you'll paste live.
export const DEMO_FALLBACK_TRANSCRIPTS: Record<string, string> = {
  // Demo reel — fill in once a real (non-mock) run against this URL has
  // captured its transcript (requires cobalt/tunnel to be up).
  // 'https://www.instagram.com/reels/DYrUc81IjAH/': '',
};
