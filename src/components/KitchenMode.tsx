'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Recipe } from '@/types/recipe';
import { clampStep, nextIndex, prevIndex, progressPercent, formatStepLabel } from './kitchenUtils';

interface KitchenModeProps {
  recipe: Recipe;
  onClose: () => void;
}

// Nav is touch/arrow-key only. Physical volume-button interception isn't a real
// browser API, so it's deliberately not implemented here.
export function KitchenMode({ recipe, onClose }: KitchenModeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const totalSteps = recipe.instructions.length;
  const safeStepIndex = clampStep(stepIndex, totalSteps);
  const goNext = () => {
    setDir(1);
    setStepIndex((prev) => nextIndex(prev, totalSteps));
  };
  const goPrev = () => {
    setDir(-1);
    setStepIndex((prev) => prevIndex(prev, totalSteps));
  };

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
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setConfirming(true);
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

  // Empty-state guard — recipe has no instructions. Placed after all hooks so
  // the hook call order stays stable on every render; navigation above is
  // already a harmless no-op in this case (nextIndex/prevIndex return 0).
  if (totalSteps === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-charcoal text-white">
        <p className="px-8 text-center text-3xl font-semibold text-sage">
          This recipe has no instructions yet.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-sage px-6 py-3 text-lg font-semibold text-charcoal hover:bg-sage/80"
          aria-label="Back to recipe"
        >
          Back to recipe
        </button>
      </div>
    );
  }

  const currentInstruction = recipe.instructions[safeStepIndex] || '';
  const isFirst = safeStepIndex === 0;
  const isLast = safeStepIndex === totalSteps - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-charcoal text-white"
    >
      {/* top bar */}
      <div className="flex flex-none items-center justify-between px-6 pt-8">
        <div className="text-sage" style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600 }}>
          {formatStepLabel(safeStepIndex, totalSteps)}
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Close Kitchen Mode"
          className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* step content */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-8">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.p
            key={safeStepIndex}
            custom={dir}
            initial={{ opacity: 0, y: dir * 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir * -60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="max-w-3xl text-center"
            style={{ fontSize: 'clamp(1.75rem, 5vw, 3.25rem)', fontWeight: 600, lineHeight: 1.3 }}
          >
            {currentInstruction}
          </motion.p>
        </AnimatePresence>

        {/* tap zones (mobile) */}
        <div className="absolute inset-0 flex sm:hidden">
          <div className="w-1/2 cursor-pointer" onClick={goPrev} aria-label="Previous step" />
          <div className="w-1/2 cursor-pointer" onClick={goNext} aria-label="Next step" />
        </div>
      </div>

      {/* progress */}
      <div className="mx-8 h-2 flex-none overflow-hidden rounded-full bg-white/15">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sage to-terracotta"
          initial={{ width: `${progressPercent(safeStepIndex, totalSteps)}%` }}
          animate={{ width: `${progressPercent(safeStepIndex, totalSteps)}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
        />
      </div>

      {/* explicit controls (desktop / accessibility) */}
      <div className="hidden flex-none items-center justify-between gap-4 px-8 pb-10 pt-6 sm:flex">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
          style={{ fontWeight: 600 }}
        >
          <ChevronLeft className="size-5" /> Back
        </button>
        <button
          type="button"
          onClick={isLast ? onClose : goNext}
          className="inline-flex items-center gap-2 rounded-full bg-terracotta px-8 py-3 text-white transition-colors hover:bg-terracotta-dark"
          style={{ fontWeight: 600 }}
        >
          {isLast ? 'Done' : 'Next'} {!isLast && <ChevronRight className="size-5" />}
        </button>
      </div>

      <div className="pb-8 text-center text-white/30 sm:hidden" style={{ fontSize: '0.75rem' }}>
        Tap left or right to navigate
      </div>

      {/* exit confirmation */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
            className="absolute inset-0 z-10 flex items-center justify-center bg-charcoal/70 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-cream p-6 text-center text-charcoal"
            >
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Exit Kitchen Mode?</h3>
              <p className="mt-2 text-charcoal/60" style={{ fontSize: '0.9rem' }}>
                You're on step {safeStepIndex + 1} of {totalSteps}. Your progress won't be saved.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full bg-terracotta py-3 text-white transition-colors hover:bg-terracotta-dark"
                  style={{ fontWeight: 700 }}
                >
                  Exit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-full border border-charcoal/20 py-3 text-charcoal transition-colors hover:bg-white/60"
                  style={{ fontWeight: 700 }}
                >
                  Keep cooking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
