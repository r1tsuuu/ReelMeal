'use client';

import { Recipe } from '@/types/recipe';

interface FilterChipsProps {
  recipes: Recipe[];
  activeFilter: string;
  onSelect: (filter: string) => void;
}

export default function FilterChips({ recipes, activeFilter, onSelect }: FilterChipsProps) {
  if (recipes.length === 0) return null;

  const tags = Array.from(new Set(recipes.flatMap((r) => r.tags)));
  const chips = [{ id: 'all', label: 'All' }, { id: 'recent', label: 'Recently Saved' }, ...tags.map((t) => ({ id: t, label: t }))];

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
      {chips.map((chip) => {
        const active = activeFilter === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip.id)}
            className={
              active
                ? 'flex-none whitespace-nowrap rounded-full border border-terracotta bg-terracotta px-3 py-1.5 text-xs font-medium text-white'
                : 'flex-none whitespace-nowrap rounded-full border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/70'
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
