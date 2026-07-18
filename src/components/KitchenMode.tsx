'use client';

import { useEffect, useRef, useState } from 'react';
import { Recipe } from '@/types/recipe';

interface KitchenModeProps {
  recipe: Recipe;
  onClose: () => void;
}

// Nav is touch/arrow-key only. Physical volume-button interception isn't a
// real browser API (OS intercepts the hardware keys before the page sees
// them), so it's deliberately not implemented here.
export default function KitchenMode({ recipe, onClose }: KitchenModeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const totalSteps = recipe.instructions.length;
  const goNext = () => setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  const goPrev = () => setStepIndex((prev) => Math.max(prev - 1, 0));

  useEffect(() => {
    if ('wakeLock' in navigator) {
      (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request('screen')
        .then((lock) => {
          wakeLockRef.current = lock;
        })
        .catch(() => console.warn('Wake lock unavailable'));
    }

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
      wakeLockRef.current?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSteps]);

  const currentInstruction = recipe.instructions[stepIndex] || '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-charcoal text-white">
      <div className="pt-8 text-center text-2xl font-bold text-sage">
        Step {stepIndex + 1} of {totalSteps}
      </div>

      <div className="flex flex-1 items-center justify-center px-8">
        <p className="text-center text-5xl font-semibold leading-relaxed">{currentInstruction}</p>
      </div>

      <div className="absolute inset-0 flex pointer-events-none">
        <div className="pointer-events-auto w-1/2 cursor-pointer" onClick={goPrev} aria-label="Previous step" />
        <div className="pointer-events-auto w-1/2 cursor-pointer" onClick={goNext} aria-label="Next step" />
      </div>

      <div className="mx-8 mb-8 h-2 rounded-full bg-sage/30">
        <div
          className="h-full rounded-full bg-sage transition-all"
          style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
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
