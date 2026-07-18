'use client';

import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Small, focused confirm modal that reuses RecipeModal's surface grammar
// (bg-cream rounded-xl card over a bg-black/50 backdrop) so it reads as the
// same product. Rendered inside RecipeModal (z-40) and must also clear
// KitchenMode's z-50 ceiling, hence z-[60]. The destructive action is red-600
// (the app's established destruction cue), NOT terracotta, which is reserved
// for primary actions (Kitchen Mode / Extract Recipe).
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the least-destructive action on open so an accidental Enter does
  // not trigger the destructive confirm (standard a11y guidance). Gated on
  // `open` so we never touch the DOM when closed.
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  // Esc key dismisses. Mirrors KitchenMode.tsx's keydown-effect pattern.
  // Listener is attached only while open and cleaned up on close/unmount.
  useEffect(() => {
    if (!open) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Stop the click from bubbling into a parent overlay's backdrop handler
        // (e.g. RecipeModal's onClick={onClose}) so dismissing this dialog does
        // not also close the modal behind it.
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-xl bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-charcoal">
          {title}
        </h2>
        <p className="mt-2 text-sm text-charcoal/70">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-charcoal/20 bg-white py-3 font-semibold text-charcoal hover:bg-charcoal/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 py-3 font-semibold text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
