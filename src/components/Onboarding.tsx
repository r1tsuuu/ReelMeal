'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Share2 } from 'lucide-react';
import { useDeviceFrame } from '@/components/DeviceFrame/FrameContext';

interface OnboardingProps {
  onFinish: () => void;
}

const slides = [
  {
    icon: <BookOpen className="size-11 text-sage-deep" strokeWidth={1.6} />,
    title: 'Turn any reel into a recipe',
    body: 'Share a cooking video from Instagram, TikTok, or YouTube — ReelMeal pulls the ingredients and steps out for you.',
    cta: "Let's cook",
  },
  {
    icon: <Share2 className="size-11 text-terracotta" strokeWidth={1.6} />,
    title: 'Tap Share, pick ReelMeal',
    body: 'Right from Instagram, TikTok, or YouTube — no copy-paste needed.',
    cta: 'Got it',
  },
];

export function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const slide = slides[step];
  const isLast = step === slides.length - 1;
  const framed = useDeviceFrame();

  const advance = () => (isLast ? onFinish() : setStep((s) => s + 1));

  return (
    <div className={`relative flex ${framed ? 'min-h-full' : 'min-h-dvh'} flex-col items-center justify-center gap-6 overflow-hidden bg-cream px-8 text-center`}>
      {/* soft background accents */}
      <div className="pointer-events-none absolute -left-16 top-10 size-56 rounded-full bg-terracotta/8 blur-2xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 size-56 rounded-full bg-sage/10 blur-2xl" />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="flex flex-col items-center gap-5"
        >
          <motion.div
            initial={{ scale: 0.8, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex size-24 items-center justify-center rounded-3xl bg-white shadow-[0_8px_30px_rgba(60,58,55,0.1)]"
          >
            {slide.icon}
          </motion.div>
          <h1 className="max-w-sm text-charcoal" style={{ fontSize: '1.9rem', fontWeight: 600, lineHeight: 1.2 }}>
            {slide.title}
          </h1>
          <p className="max-w-xs text-charcoal/65" style={{ lineHeight: 1.55 }}>
            {slide.body}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* dots */}
      <div className="flex gap-1.5">
        {slides.map((_, i) => (
          <motion.span
            key={i}
            animate={{ width: i === step ? 22 : 8, backgroundColor: i === step ? 'var(--terracotta)' : 'rgba(60,58,55,0.15)' }}
            className="h-1.5 rounded-full"
          />
        ))}
      </div>

      <div className="flex w-full max-w-[240px] flex-col items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={advance}
          className="w-full rounded-full bg-terracotta py-3.5 text-white shadow-sm transition-colors hover:bg-terracotta-dark"
          style={{ fontWeight: 600 }}
        >
          {slide.cta}
        </motion.button>
        {!isLast && (
          <button type="button" onClick={onFinish} className="text-terracotta transition-opacity hover:opacity-70" style={{ fontSize: '0.85rem' }}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
