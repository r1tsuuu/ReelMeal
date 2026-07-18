'use client';

import { useState } from 'react';
import { Recipe } from '@/types/recipe';

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onKitchenMode: () => void;
}

export default function RecipeModal({ recipe, onClose, onKitchenMode }: RecipeModalProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-cream p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold text-charcoal">{recipe.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-charcoal/50 hover:text-charcoal"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-4 text-sm text-charcoal/70">
          <span>Servings: {recipe.servings}</span>
          <span>Prep: {recipe.prepTime}</span>
          <span>Cook: {recipe.cookTime}</span>
        </div>

        <h3 className="mb-2 font-semibold text-charcoal">Ingredients</h3>
        <ul className="mb-4 space-y-1">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`}>
              <label className="flex items-center gap-2 text-charcoal">
                <input
                  type="checkbox"
                  checked={checkedIngredients.has(index)}
                  onChange={() => toggleIngredient(index)}
                />
                <span className={checkedIngredients.has(index) ? 'line-through opacity-50' : ''}>
                  {ingredient.amount} {ingredient.unit} {ingredient.name}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 font-semibold text-charcoal">Instructions</h3>
        <ol className="mb-6 list-decimal space-y-2 pl-5 text-charcoal">
          {recipe.instructions.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onKitchenMode}
          className="w-full rounded-lg bg-terracotta py-3 font-semibold text-white"
        >
          Kitchen Mode
        </button>
      </div>
    </div>
  );
}
