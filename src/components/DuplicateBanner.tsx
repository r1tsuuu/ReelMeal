'use client';

interface DuplicateBannerProps {
  title: string;
  onView: () => void;
  onDismiss: () => void;
}

export default function DuplicateBanner({ title, onView, onDismiss }: DuplicateBannerProps) {
  return (
    <div className="mx-4 mb-1 flex items-center gap-2 rounded-2xl bg-sage/15 px-3 py-2.5 text-sm text-charcoal">
      <span className="flex-1">Already in your Vault — {title}</span>
      <button type="button" onClick={onView} className="font-semibold text-sage">
        View
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-charcoal/40 hover:text-charcoal">
        ✕
      </button>
    </div>
  );
}
