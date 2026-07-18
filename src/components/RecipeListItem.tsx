'use client';

import { motion } from 'motion/react';
import { ChefHat, ChevronRight } from 'lucide-react';
import { Recipe } from '@/types/recipe';
import { getSourceLabel } from '@/utils/source';
import { useLongPress } from '@/hooks/useLongPress';

interface RecipeListItemProps {
  recipe: Recipe;
  onClick: () => void;
  onLongPress?: () => void;
}

export function RecipeListItem({ recipe, onClick, onLongPress }: RecipeListItemProps) {
  const longPress = useLongPress(onLongPress ?? onClick, onClick);

  return (
    <motion.button
      type="button"
      layout
      {...longPress}
      whileTap={{ scale: 0.99 }}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white/60 px-3 py-3 text-left transition-colors hover:bg-white"
    >
      <div className="flex size-12 flex-none items-center justify-center rounded-xl bg-cream-deep text-sage-deep transition-transform group-hover:scale-105">
        <ChefHat className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-charcoal" style={{ fontWeight: 600 }}>
          {recipe.title}
        </div>
        <div className="truncate text-charcoal/55" style={{ fontSize: '0.78rem' }}>
          {recipe.servings} servings · {recipe.cookTime} · {recipe.ingredients.length} ingredients
        </div>
      </div>
      <span className="flex-none rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
        {getSourceLabel(recipe.sourceUrl)}
      </span>
      <ChevronRight className="size-4 flex-none text-charcoal/30 transition-transform group-hover:translate-x-0.5" />
    </motion.button>
  );
}
