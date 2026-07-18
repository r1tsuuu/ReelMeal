'use client';

import { motion } from 'motion/react';
import { Clock, Users, Utensils, Bookmark } from 'lucide-react';
import { Recipe } from '@/types/recipe';
import { getSourceLabel } from '@/utils/source';
import { useLongPress } from '@/hooks/useLongPress';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onLongPress?: () => void;
}

export function RecipeCard({ recipe, onClick, onLongPress }: RecipeCardProps) {
  const longPress = useLongPress(onLongPress ?? onClick, onClick);
  const saved = recipe.collections.length > 0;

  return (
    <motion.button
      type="button"
      layout
      {...longPress}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="group relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-[0_2px_10px_rgba(60,58,55,0.06)] ring-1 ring-charcoal/5 transition-shadow hover:shadow-[0_10px_30px_rgba(60,58,55,0.12)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2.5 py-1 text-[11px] font-semibold text-terracotta">
          {getSourceLabel(recipe.sourceUrl)}
        </span>
        {saved && (
          <span className="text-sage" title="Saved to a collection">
            <Bookmark className="size-4 fill-sage/20" />
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 pr-1 text-charcoal" style={{ fontSize: '1.15rem', fontWeight: 600 }}>
        {recipe.title}
      </h3>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-charcoal/60" style={{ fontSize: '0.8rem' }}>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" /> {recipe.servings}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" /> {recipe.cookTime}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sage-deep">
          <Utensils className="size-3.5" /> {recipe.ingredients.length}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-terracotta to-sage transition-transform duration-300 group-hover:scale-x-100" />
    </motion.button>
  );
}
