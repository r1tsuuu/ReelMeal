'use client';

import { Recipe } from '@/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl bg-white p-4 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <h3 className="text-lg font-semibold text-charcoal">{recipe.title}</h3>
      <div className="flex flex-wrap gap-3 text-sm text-charcoal/70">
        <span>{recipe.servings} servings</span>
        <span>Prep {recipe.prepTime}</span>
        <span>Cook {recipe.cookTime}</span>
      </div>
      <p className="text-sm text-sage">{recipe.ingredients.length} ingredients</p>
    </button>
  );
}
