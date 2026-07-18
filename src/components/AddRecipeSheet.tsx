'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link2, Loader2, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { LoadingStage, Recipe } from '@/types/recipe';

interface AddRecipeSheetProps {
  onClose: () => void;
  onExtracted: (recipe: Recipe) => void;
}

const STAGE_LABELS: Record<Exclude<LoadingStage, 'idle' | 'error'>, string> = {
  sharing: 'Reading the link',
  fetching_stream: 'Fetching the video',
  transcribing_audio: 'Transcribing audio',
  parsing_ai: 'Extracting the recipe',
};

const STAGE_ORDER: (keyof typeof STAGE_LABELS)[] = [
  'sharing',
  'fetching_stream',
  'transcribing_audio',
  'parsing_ai',
];

// Builds a plausible recipe so the extraction flow is demonstrable without a backend.
function buildMockRecipe(url: string): Recipe {
  const now = new Date().toISOString();
  return {
    id: `mock-${Date.now()}`,
    title: 'Spicy Miso Butter Corn Ramen',
    sourceUrl: url,
    extractedAt: now,
    servings: '2',
    prepTime: '10 mins',
    cookTime: '15 mins',
    ingredients: [
      { name: 'ramen noodles', amount: '2', unit: 'portions' },
      { name: 'white miso paste', amount: '2', unit: 'tbsp' },
      { name: 'unsalted butter', amount: '2', unit: 'tbsp' },
      { name: 'sweet corn', amount: '1', unit: 'cup' },
      { name: 'chili oil', amount: '1', unit: 'tbsp' },
      { name: 'soft-boiled egg', amount: '2', unit: '' },
    ],
    instructions: [
      'Whisk the miso paste into 3 cups of hot stock until smooth.',
      'Melt the butter in a pan and blister the corn until lightly charred.',
      'Cook the ramen noodles until just tender, then drain.',
      'Divide the noodles between bowls and pour over the miso broth.',
      'Top with charred corn, a soft-boiled egg, and a swirl of chili oil.',
    ],
    tags: ['Quick', 'Noodles', 'Dinner'],
    collections: [],
    savedAt: null,
  };
}

function isLikelyUrl(value: string) {
  return /^https?:\/\/.+\..+/i.test(value.trim());
}

export function AddRecipeSheet({ onClose, onExtracted }: AddRecipeSheetProps) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<LoadingStage>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const running = stage !== 'idle' && stage !== 'error';
  const activeIdx = running ? STAGE_ORDER.indexOf(stage as keyof typeof STAGE_LABELS) : -1;

  const extract = async () => {
    const trimmed = url.trim();
    if (!isLikelyUrl(trimmed)) {
      setStage('error');
      setErrorMsg("That doesn't look like a video link. Paste a full URL starting with http.");
      return;
    }

    setErrorMsg('');
    try {
      for (const s of STAGE_ORDER) {
        setStage(s);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 750));
      }
      // Simulate the AI occasionally failing to find a recipe in the video.
      if (/fail|error/i.test(trimmed)) {
        throw new Error("We couldn't find a recipe in that video. Try another link.");
      }
      onExtracted(buildMockRecipe(trimmed));
    } catch (err) {
      setStage('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const retry = () => {
    setStage('idle');
    setErrorMsg('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={running ? undefined : onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-cream p-6 sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-charcoal/15 sm:hidden" />
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-charcoal" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            Add a recipe
          </h2>
          {!running && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-charcoal/40 transition-colors hover:bg-charcoal/5 hover:text-charcoal"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <p className="mb-5 text-charcoal/60" style={{ fontSize: '0.85rem' }}>
          Paste a link to a cooking video and we'll pull out the recipe.
        </p>

        <AnimatePresence mode="wait">
          {stage === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-7" />
              </span>
              <div>
                <div className="text-charcoal" style={{ fontWeight: 600 }}>
                  Extraction failed
                </div>
                <p className="mt-1 max-w-xs text-charcoal/60" style={{ fontSize: '0.85rem' }}>
                  {errorMsg}
                </p>
              </div>
              <button
                type="button"
                onClick={retry}
                className="mx-auto inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3 text-white shadow-sm transition-colors hover:bg-terracotta-dark"
                style={{ fontWeight: 600 }}
              >
                <RotateCcw className="size-4" /> Try again
              </button>
            </motion.div>
          ) : !running ? (
            <motion.div key="form" exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 rounded-full border border-charcoal/15 bg-white px-4 py-3 transition-shadow focus-within:ring-2 focus-within:ring-terracotta/40">
                <Link2 className="size-4 flex-none text-charcoal/40" />
                <input
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && extract()}
                  placeholder="Paste video URL…"
                  className="flex-1 bg-transparent text-charcoal outline-none"
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={extract}
                  className="w-full max-w-[260px] rounded-full bg-terracotta py-3.5 text-white shadow-sm transition-colors hover:bg-terracotta-dark"
                  style={{ fontWeight: 600 }}
                >
                  Extract recipe
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 py-2">
              {STAGE_ORDER.map((s, i) => {
                const done = i < activeIdx;
                const active = i === activeIdx;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span
                      className={`flex size-7 flex-none items-center justify-center rounded-full transition-colors ${
                        done ? 'bg-sage text-white' : active ? 'bg-terracotta/15 text-terracotta' : 'bg-charcoal/8 text-charcoal/30'
                      }`}
                    >
                      {done ? (
                        <Check className="size-4" strokeWidth={3} />
                      ) : active ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <span
                      className="transition-colors"
                      style={{
                        color: done ? 'var(--sage-deep)' : active ? 'var(--charcoal)' : 'rgba(60,58,55,0.4)',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
