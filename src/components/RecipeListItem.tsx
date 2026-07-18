'use client';

import { Recipe } from '@/types/recipe';
import { getSourceLabel } from '@/utils/source';

interface RecipeListItemProps {
  recipe: Recipe;
  onClick: () => void;
}

export default function RecipeListItem({ recipe, onClick }: RecipeListItemProps) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-charcoal/10 py-3 text-left">
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-cream text-charcoal/40">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="8" cy="8" r="2" />
          <path d="M3 17l5-6 4 4 3-4 6 6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-charcoal">{recipe.title}</div>
        <div className="truncate text-xs text-charcoal/60">
          {recipe.servings} servings · {recipe.cookTime} · {recipe.ingredients.length} ingredients
        </div>
      </div>
      <span className="flex-none rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] font-medium text-charcoal/60">
        {getSourceLabel(recipe.sourceUrl)}
      </span>
    </button>
  );
}
