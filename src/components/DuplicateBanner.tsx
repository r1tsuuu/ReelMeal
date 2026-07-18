'use client';

import { motion } from 'motion/react';
import { Info, X } from 'lucide-react';

interface DuplicateBannerProps {
  title: string;
  onView: () => void;
  onDismiss: () => void;
}

export function DuplicateBanner({ title, onView, onDismiss }: DuplicateBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="mx-4 mb-2 flex items-center gap-2 overflow-hidden rounded-2xl bg-sage/15 px-3.5 py-3 text-sm text-charcoal"
    >
      <Info className="size-4 flex-none text-sage-deep" />
      <span className="flex-1 truncate">
        Already in your Vault — <span className="font-semibold">{title}</span>
      </span>
      <button type="button" onClick={onView} className="flex-none font-semibold text-sage-deep hover:underline">
        View
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex-none rounded-full p-1 text-charcoal/40 transition-colors hover:bg-charcoal/5 hover:text-charcoal"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}
