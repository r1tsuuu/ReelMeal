'use client';

import { useEffect, useRef, useState } from 'react';
import { Recipe } from '@/types/recipe';
import {
  clampStep,
  formatStepLabel,
  nextIndex,
  prevIndex,
  progressPercent,
} from './kitchenUtils';

interface KitchenModeProps {
  recipe: Recipe;
  onClose: () => void;
}

// Nav is touch/arrow-key only. Physical volume-button interception isn't a
// real browser API (OS intercepts the hardware keys before the page sees
// them), so it's deliberately not implemented here.
export default function KitchenMode({ recipe, onClose }: KitchenModeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [hintSeen, setHintSeen] = useState(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const totalSteps = recipe.instructions.length;
  const safeStepIndex = clampStep(stepIndex, totalSteps);

  const goNext = () => {
    setHintSeen(true);
    setStepIndex((prev) => nextIndex(prev, totalSteps));
  };
  const goPrev = () => setStepIndex((prev) => prevIndex(prev, totalSteps));

  // Effect 1 — keyboard nav + body scroll lock. Rebinds when the step count
  // changes (e.g. a new recipe is passed in while mounted).
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSteps]);

  // Effect 2 — wake-lock lifecycle. Browsers auto-release the sentinel when
  // the tab hides / screen sleeps, so re-request it when the tab is visible
  // again. Dep `[]`: acquire once on mount, listen, cleanup on unmount — no
  // rebinding per step.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    type WakeLockSentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    };

    const acquire = () => {
      nav.wakeLock
        .request('screen')
        .then((lock) => {
          // Release any previously held sentinel before swapping the ref.
          // The browser already auto-released the old one on tab hide, but a
          // fresh request returns a fresh sentinel — don't leak the handle.
          wakeLockRef.current?.release().catch(() => {});
          wakeLockRef.current = lock;
        })
        .catch(() => console.warn('Wake lock unavailable'));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // Empty-state guard — recipe has no instructions. Placed after all hooks so
  // the hook call order stays stable on every render. The effects above still
  // run; navigation is a harmless no-op (nextIndex/prevIndex return 0).
  if (totalSteps === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-charcoal text-white">
        <p className="px-8 text-center text-3xl font-semibold text-sage">
          This recipe has no instructions yet.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-sage px-6 py-3 text-lg font-semibold text-charcoal hover:bg-sage/80"
          aria-label="Close Kitchen Mode"
        >
          Back to recipe
        </button>
      </div>
    );
  }

  const currentInstruction = recipe.instructions[safeStepIndex] || '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-charcoal text-white">
      <div className="pt-8 text-center text-2xl font-bold text-sage">
        {formatStepLabel(safeStepIndex, totalSteps)}
      </div>

      <div className="relative flex flex-1 items-center justify-center px-8">
        <p className="text-center text-5xl font-semibold leading-relaxed">{currentInstruction}</p>
        {safeStepIndex === 0 && !hintSeen && (
          <p className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2 text-base text-white/50">
            Tap right half → next step
          </p>
        )}
      </div>

      <div className="absolute inset-0 flex pointer-events-none">
        <div className="pointer-events-auto w-1/2 cursor-pointer" onClick={goPrev} aria-label="Previous step" />
        <div className="pointer-events-auto w-1/2 cursor-pointer" onClick={goNext} aria-label="Next step" />
      </div>

      <div className="mx-8 mb-8 h-2 rounded-full bg-sage/30">
        <div
          className="h-full rounded-full bg-sage transition-all"
          style={{ width: `${progressPercent(safeStepIndex, totalSteps)}%` }}
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 text-2xl text-white/50 hover:text-white"
        aria-label="Close Kitchen Mode"
      >
        ✕
      </button>
    </div>
  );
}
