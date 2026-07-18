'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link2, Loader2, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { APIResponsePayload, LoadingStage, Recipe } from '@/types/recipe';
import { API_ENDPOINT } from '@/utils/constants';
import { isValidInstagramUrl } from '@/utils/regex';

interface AddRecipeSheetProps {
  onClose: () => void;
  onExtracted: (recipe: Recipe) => void;
  // Pre-filled from the Android share-sheet flow (?shareUrl=...) — when set,
  // extraction starts immediately instead of waiting for the user to submit.
  initialUrl?: string;
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

// The real API returns once, at the end — it doesn't stream back which phase
// it's in. This cycles the stage labels on a timer purely as a perceived-
// progress indicator while the real request is in flight; it holds on the
// last stage if the request runs longer than the simulated cycle, and never
// claims to be done before the real response actually arrives.
const STAGE_STEP_MS = 2500;

export function AddRecipeSheet({ onClose, onExtracted, initialUrl = '' }: AddRecipeSheetProps) {
  const [url, setUrl] = useState(initialUrl);
  const [stage, setStage] = useState<LoadingStage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const cancelledRef = useRef(false);

  const running = stage !== 'idle' && stage !== 'error';
  const activeIdx = running ? STAGE_ORDER.indexOf(stage as keyof typeof STAGE_LABELS) : -1;

  const extract = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!isValidInstagramUrl(trimmed)) {
      setStage('error');
      setErrorMsg('Please paste a valid Instagram reel or post URL.');
      return;
    }

    setErrorMsg('');
    cancelledRef.current = false;

    void (async () => {
      for (const s of STAGE_ORDER) {
        if (cancelledRef.current) return;
        setStage(s);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, STAGE_STEP_MS));
      }
    })();

    try {
      const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, useMock }),
      });
      const data: APIResponsePayload = await response.json();
      cancelledRef.current = true;

      if (data.success && data.recipe) {
        onExtracted(data.recipe);
      } else {
        setStage('error');
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      cancelledRef.current = true;
      setStage('error');
      setErrorMsg('Network error — check your connection and try again.');
    }
  };

  useEffect(() => {
    if (initialUrl) void extract(initialUrl);
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

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
          Paste a link to an Instagram reel and we'll pull out the recipe.
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
                  onKeyDown={(e) => e.key === 'Enter' && extract(url)}
                  placeholder="Paste Instagram reel URL…"
                  className="flex-1 bg-transparent text-charcoal outline-none"
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => extract(url)}
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
