'use client';

import { motion } from 'motion/react';
import { Recipe } from '@/types/recipe';

interface FilterChipsProps {
  recipes: Recipe[];
  activeFilter: string;
  onSelect: (filter: string) => void;
}

export function FilterChips({ recipes, activeFilter, onSelect }: FilterChipsProps) {
  if (recipes.length === 0) return null;

  const tags = Array.from(new Set(recipes.flatMap((r) => r.tags)));
  const chips = [
    { id: 'all', label: 'All' },
    { id: 'recent', label: 'Recently Saved' },
    ...tags.map((t) => ({ id: t, label: t })),
  ];

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
      {chips.map((chip) => {
        const active = activeFilter === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip.id)}
            className="relative flex-none whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: active ? '#fff' : 'rgba(60,58,55,0.7)' }}
          >
            {active && (
              <motion.span
                layoutId="active-chip"
                className="absolute inset-0 rounded-full bg-terracotta shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            {!active && <span className="absolute inset-0 rounded-full border border-charcoal/15 bg-white" />}
            <span className="relative">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
