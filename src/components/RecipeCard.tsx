'use client';

import { Recipe } from '@/types/recipe';
import { getSourceLabel } from '@/utils/source';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col gap-2 rounded-xl bg-white p-4 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span className="absolute right-3 top-3 rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] font-medium text-charcoal/60">
        {getSourceLabel(recipe.sourceUrl)}
      </span>
      <h3 className="pr-8 text-lg font-semibold text-charcoal">{recipe.title}</h3>
      <div className="flex flex-wrap gap-3 text-sm text-charcoal/70">
        <span>{recipe.servings} servings</span>
        <span>Cook {recipe.cookTime}</span>
      </div>
      <p className="text-sm text-sage">{recipe.ingredients.length} ingredients</p>
    </button>
  );
}
