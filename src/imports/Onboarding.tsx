'use client';

import { useState } from 'react';

interface OnboardingProps {
  onFinish: () => void;
}

// Two screens: the pitch, then how the share-sheet flow works. "Let's cook" on the
// first screen advances here rather than finishing onboarding directly.
export default function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState<0 | 1>(0);

  if (step === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-cream px-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-sage/15">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#5C7451" strokeWidth="1.7">
            <rect x="4" y="3" width="16" height="18" rx="3" />
            <path d="M9 8h6M9 12h6M9 16h3" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-charcoal">Turn any reel into a recipe</h1>
        <p className="max-w-xs text-sm text-charcoal/70">
          Share a cooking video from Instagram, TikTok, or YouTube — ReelMeal pulls the ingredients and steps out for you.
        </p>
        <button type="button" onClick={() => setStep(1)} className="w-full max-w-[210px] rounded-full bg-terracotta py-3 font-semibold text-white">
          Let&apos;s cook
        </button>
        <button type="button" onClick={onFinish} className="text-sm text-terracotta">
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-cream px-8 text-center">
      <div className="flex gap-1.5">
        <span className="h-1 w-5 rounded-full bg-charcoal/15" />
        <span className="h-1 w-5 rounded-full bg-terracotta" />
      </div>
      <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" strokeWidth="1.5">
        <rect x="3" y="2" width="18" height="20" rx="3" />
        <path d="M9 6h6M9 18h2" />
      </svg>
      <h1 className="text-2xl font-bold text-charcoal">Tap Share, pick ReelMeal</h1>
      <p className="max-w-xs text-sm text-charcoal/70">Right from Instagram, TikTok, or YouTube — no copy-paste needed.</p>
      <button type="button" onClick={onFinish} className="w-full max-w-[210px] rounded-full bg-terracotta py-3 font-semibold text-white">
        Got it
      </button>
    </div>
  );
}
