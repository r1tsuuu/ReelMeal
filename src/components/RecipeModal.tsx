'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Trash2, Check, Image as ImageIcon } from 'lucide-react';
import { Recipe } from '@/types/recipe';
import { useLongPress } from '@/hooks/useLongPress';
import ConfirmDialog from './ConfirmDialog';
import { useDeviceFrame } from '@/components/DeviceFrame';

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onKitchenMode: () => void;
  onEditCollections: () => void;
  onUnsave: () => void;
  onDelete: () => void;
}

type Tab = 'ingredients' | 'steps';

export function RecipeModal({
  recipe,
  onClose,
  onKitchenMode,
  onEditCollections,
  onUnsave,
  onDelete,
}: RecipeModalProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<Tab>('ingredients');
  const [showConfirm, setShowConfirm] = useState(false);

  const framed = useDeviceFrame();

  const saved = recipe.collections.length > 0 || recipe.savedAt !== null;

  // Tap unsaves; press-and-hold re-opens the collections picker to rechoose.
  const saveButtonPress = useLongPress(onEditCollections, saved ? onUnsave : onEditCollections);

  const toggle = (index: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });

  const chips = [
    `${recipe.servings}servings`,
    `Prep${recipe.prepTime}`,
    `Cook${recipe.cookTime}`,
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-40 flex items-stretch justify-center bg-charcoal/50 sm:items-center sm:p-4 sm:backdrop-blur-sm`}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-hidden bg-cream sm:h-[92vh] sm:max-w-md sm:rounded-3xl"
      >
        {/* Banner */}
        <div
          className="relative flex h-52 flex-none items-center justify-center"
          style={{ backgroundColor: '#d8c5a7' }}
        >
          <ImageIcon className="size-9 text-charcoal/45" strokeWidth={1.6} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-cream text-charcoal shadow-sm transition-colors hover:bg-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            aria-label="Delete recipe"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-cream text-charcoal shadow-sm transition-colors hover:bg-white hover:text-terracotta"
          >
            <Trash2 className="size-5" />
          </button>
        </div>

        {/* Title + chips + tabs */}
        <div className="flex-none px-5 pb-3 pt-5">
          <h2 className="text-charcoal" style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
            {recipe.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full border border-terracotta/50 px-3 py-1.5 text-terracotta"
                style={{ fontSize: '0.85rem' }}
              >
                {c}
              </span>
            ))}
          </div>

          <div className="mt-4 inline-flex rounded-full bg-charcoal/5 p-1">
            {(['ingredients', 'steps'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="relative rounded-full px-5 py-1.5 capitalize transition-colors"
                style={{ color: tab === t ? '#fff' : 'rgba(60,58,55,0.75)', fontWeight: 600 }}
              >
                {tab === t && (
                  <motion.span
                    layoutId="recipe-tab"
                    className="absolute inset-0 rounded-full bg-terracotta"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}
                <span className="relative">{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <AnimatePresence mode="wait">
            {tab === 'ingredients' ? (
              <motion.ul
                key="ingredients"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                {recipe.ingredients.map((ingredient, index) => {
                  const on = checked.has(index);
                  return (
                    <li key={`${ingredient.name}-${index}`} className="border-b border-charcoal/12">
                      <button
                        type="button"
                        onClick={() => toggle(index)}
                        className="flex w-full items-center gap-3 py-4 text-left"
                      >
                        <span
                          className={`flex size-6 flex-none items-center justify-center rounded-[5px] border-2 transition-colors ${
                            on ? 'border-sage bg-sage text-white' : 'border-charcoal/35 bg-transparent'
                          }`}
                        >
                          {on && <Check className="size-4" strokeWidth={3} />}
                        </span>
                        <span
                          className={`transition-all ${on ? 'text-charcoal/40 line-through' : 'text-charcoal'}`}
                          style={{ fontSize: '1.05rem' }}
                        >
                          {ingredient.amount} {ingredient.unit} {ingredient.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            ) : (
              <motion.ol
                key="steps"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="space-y-3 pt-2"
              >
                {recipe.instructions.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span
                      className="flex size-7 flex-none items-center justify-center rounded-full bg-terracotta/15 text-terracotta"
                      style={{ fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-charcoal/85" style={{ lineHeight: 1.55 }}>
                      {step}
                    </p>
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex flex-none gap-3 border-t border-charcoal/10 bg-cream p-4">
          <button
            type="button"
            {...saveButtonPress}
            title={saved ? 'Tap to unsave · hold to edit collections' : 'Save to a collection'}
            className="flex-1 rounded-full border border-charcoal/25 bg-transparent py-3.5 text-charcoal transition-colors hover:bg-white/60"
            style={{ fontWeight: 700 }}
          >
            {saved ? 'Unsave' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onKitchenMode}
            className="flex-[1.4] rounded-full bg-terracotta py-3.5 text-white shadow-sm transition-colors hover:bg-terracotta-dark"
            style={{ fontWeight: 700 }}
          >
            Start Kitchen Mode
          </button>
        </div>
      </motion.div>

      <ConfirmDialog
        open={showConfirm}
        title={'Remove "' + recipe.title + '" from your vault?'}
        message="This can't be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowConfirm(false);
          onDelete();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </motion.div>
  );
}
