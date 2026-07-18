'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Search, LayoutGrid, List, ChefHat, BookMarked, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/app/components/ui/sonner';
import { Collection, Recipe } from '@/types/recipe';
import { mockRecipePool } from '@/utils/mockData';
import { DEFAULT_COLLECTION } from '@/utils/constants';
import { Onboarding } from '@/components/Onboarding';
import { RecipeCard } from '@/components/RecipeCard';
import { RecipeListItem } from '@/components/RecipeListItem';
import { FilterChips } from '@/components/FilterChips';
import { RecipeModal } from '@/components/RecipeModal';
import { CollectionsModal } from '@/components/CollectionsModal';
import { KitchenMode } from '@/components/KitchenMode';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { AddRecipeSheet } from '@/components/AddRecipeSheet';

type View = 'grid' | 'list';

// Seed the Vault from the shared mock pool so the demo starts with saved recipes.
const SEED_RECIPES: Recipe[] = mockRecipePool.map((tpl, i) => ({
  ...tpl,
  extractedAt: new Date(Date.now() - i * 86400000).toISOString(),
  collections: [DEFAULT_COLLECTION.id],
  savedAt: new Date(Date.now() - i * 86400000).toISOString(),
}));

const SEED_COLLECTIONS: Collection[] = [
  DEFAULT_COLLECTION,
  { id: 'weeknight', name: 'Weeknight Dinners' },
  { id: 'sweet', name: 'Sweet Treats' },
];

export default function App() {
  const [onboarded, setOnboarded] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>(SEED_RECIPES);
  const [collections, setCollections] = useState<Collection[]>(SEED_COLLECTIONS);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<View>('grid');

  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  const [kitchenRecipe, setKitchenRecipe] = useState<Recipe | null>(null);
  const [collectionsFor, setCollectionsFor] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [duplicate, setDuplicate] = useState<Recipe | null>(null);
  // A freshly extracted recipe that hasn't been saved into any collection yet.
  // If the user leaves its detail view without saving, it's discarded.
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = recipes;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (filter === 'recent') {
      list = [...list].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    } else if (filter !== 'all') {
      list = list.filter((r) => r.tags.includes(filter));
    }
    return list;
  }, [recipes, query, filter]);

  const createCollection = (name: string): string => {
    const id = `col-${Date.now()}`;
    setCollections((prev) => [...prev, { id, name }]);
    return id;
  };

  const saveCollections = (recipeId: string, ids: string[]) => {
    const savedAt = ids.length ? new Date().toISOString() : null;
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipeId ? { ...r, collections: ids, savedAt } : r)),
    );
    setOpenRecipe((cur) => (cur && cur.id === recipeId ? { ...cur, collections: ids, savedAt } : cur));
    setCollectionsFor(null);
    if (ids.length) {
      // Once saved anywhere, it's a permanent Vault recipe — no longer pending.
      setPendingRecipeId((cur) => (cur === recipeId ? null : cur));
      toast.success('Saved to your collections');
    } else {
      toast('Removed from collections');
    }
  };

  const unsaveRecipe = (recipeId: string) => {
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipeId ? { ...r, collections: [], savedAt: null } : r)),
    );
    setOpenRecipe((cur) => (cur && cur.id === recipeId ? { ...cur, collections: [], savedAt: null } : cur));
    toast('Removed from your Vault');
  };

  const deleteRecipe = (recipeId: string) => {
    const removed = recipes.find((r) => r.id === recipeId);
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
    setPendingRecipeId((cur) => (cur === recipeId ? null : cur));
    setOpenRecipe(null);
    toast.success('Recipe deleted', {
      description: removed?.title,
      action: removed
        ? {
            label: 'Undo',
            onClick: () => setRecipes((prev) => [removed, ...prev.filter((r) => r.id !== removed.id)]),
          }
        : undefined,
    });
  };

  const handleExtracted = (recipe: Recipe) => {
    const existing = recipes.find((r) => r.sourceUrl === recipe.sourceUrl);
    setAdding(false);
    if (existing) {
      setDuplicate(existing);
      toast('This recipe is already in your Vault');
      return;
    }
    setRecipes((prev) => [recipe, ...prev]);
    setOpenRecipe(recipe);
    setPendingRecipeId(recipe.id);
    toast.success('Recipe extracted', { description: recipe.title });
  };

  // Closing the detail view. A pending (freshly extracted, never-saved) recipe is
  // discarded if the user backs out without saving it into any collection.
  const closeRecipe = () => {
    if (openRecipe && pendingRecipeId === openRecipe.id) {
      const live = recipes.find((r) => r.id === openRecipe.id);
      const unsaved = live && live.collections.length === 0 && live.savedAt === null;
      if (unsaved) {
        setRecipes((prev) => prev.filter((r) => r.id !== openRecipe.id));
        toast('Recipe discarded');
      }
      setPendingRecipeId(null);
    }
    setOpenRecipe(null);
  };

  if (!onboarded) {
    return <Onboarding onFinish={() => setOnboarded(true)} />;
  }

  return (
    <div className="min-h-dvh bg-cream text-charcoal">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-charcoal/8 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-terracotta text-white">
                <ChefHat className="size-5" />
              </span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, lineHeight: 1 }}>
                  ReelMeal
                </div>
                <div className="text-charcoal/45" style={{ fontSize: '0.7rem' }}>
                  {recipes.length} recipes in your Vault
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-charcoal/8">
              {(['grid', 'list'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-label={`${v} view`}
                  className={`rounded-full p-2 transition-colors ${
                    view === v ? 'bg-terracotta text-white' : 'text-charcoal/50 hover:text-charcoal'
                  }`}
                >
                  {v === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-2 rounded-full border border-charcoal/12 bg-white px-4 py-2.5 transition-shadow focus-within:ring-2 focus-within:ring-terracotta/30">
            <Search className="size-4 flex-none text-charcoal/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes or tags…"
              className="flex-1 bg-transparent text-charcoal outline-none"
            />
          </div>
        </div>

        <div className="mx-auto max-w-5xl">
          <FilterChips recipes={recipes} activeFilter={filter} onSelect={setFilter} />
        </div>
      </header>

      {/* Duplicate banner */}
      <div className="mx-auto max-w-5xl pt-3">
        <AnimatePresence>
          {duplicate && (
            <DuplicateBanner
              key={duplicate.id}
              title={duplicate.title}
              onView={() => {
                setOpenRecipe(duplicate);
                setDuplicate(null);
              }}
              onDismiss={() => setDuplicate(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-3">
        {filtered.length === 0 ? (
          recipes.length === 0 ? (
            /* Empty vault */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-24 text-center"
            >
              <span className="flex size-16 items-center justify-center rounded-2xl bg-cream-deep text-sage-deep">
                <BookMarked className="size-7" />
              </span>
              <h2 className="text-charcoal" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                Your Vault is empty
              </h2>
              <p className="max-w-xs text-charcoal/55" style={{ fontSize: '0.9rem' }}>
                Add your first recipe by pasting a link to a cooking video.
              </p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-3 text-white shadow-sm transition-colors hover:bg-terracotta-dark"
                style={{ fontWeight: 600 }}
              >
                <Plus className="size-4" /> Add a recipe
              </button>
            </motion.div>
          ) : (
            /* No search/filter results */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-24 text-center"
            >
              <span className="flex size-16 items-center justify-center rounded-2xl bg-cream-deep text-charcoal/40">
                <SearchX className="size-7" />
              </span>
              <h2 className="text-charcoal" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                No recipes found
              </h2>
              <p className="max-w-xs text-charcoal/55" style={{ fontSize: '0.9rem' }}>
                {query ? (
                  <>Nothing matches “{query}”. Try another search or filter.</>
                ) : (
                  'No recipes match this filter yet.'
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="mt-2 rounded-full border border-charcoal/20 bg-white px-5 py-2.5 text-charcoal transition-colors hover:bg-cream-deep"
                style={{ fontWeight: 600 }}
              >
                Clear filters
              </button>
            </motion.div>
          )
        ) : view === 'grid' ? (
          <motion.div
            layout
            className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((recipe) => (
                <motion.div
                  key={recipe.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="h-full"
                >
                  <RecipeCard
                    recipe={recipe}
                    onClick={() => setOpenRecipe(recipe)}
                    onLongPress={() => setCollectionsFor(recipe)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div layout className="flex flex-col gap-1.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((recipe) => (
                <motion.div
                  key={recipe.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                >
                  <RecipeListItem
                    recipe={recipe}
                    onClick={() => setOpenRecipe(recipe)}
                    onLongPress={() => setCollectionsFor(recipe)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Floating add button */}
      <motion.button
        type="button"
        onClick={() => setAdding(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 left-1/2 z-30 flex items-center gap-2 rounded-full bg-terracotta px-5 py-4 text-white shadow-[0_10px_30px_rgba(217,113,78,0.4)] transition-colors hover:bg-terracotta-dark"
        style={{ fontWeight: 600, x: '-50%' }}
      >
        <Plus className="size-5" />
        <span className="hidden sm:inline">Add recipe</span>
      </motion.button>

      {/* Overlays */}
      <AnimatePresence>
        {adding && (
          <AddRecipeSheet key="add" onClose={() => setAdding(false)} onExtracted={handleExtracted} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openRecipe && (
          <RecipeModal
            key="recipe"
            recipe={openRecipe}
            onClose={closeRecipe}
            onKitchenMode={() => {
              // Cooking a recipe keeps it in the Vault even if never explicitly saved.
              setPendingRecipeId((cur) => (cur === openRecipe.id ? null : cur));
              setKitchenRecipe(openRecipe);
              setOpenRecipe(null);
            }}
            onEditCollections={() => setCollectionsFor(openRecipe)}
            onUnsave={() => unsaveRecipe(openRecipe.id)}
            onDelete={() => deleteRecipe(openRecipe.id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionsFor && (
          <CollectionsModal
            key="collections"
            collections={collections}
            initialSelected={collectionsFor.collections}
            onCreateCollection={createCollection}
            onConfirm={(ids) => saveCollections(collectionsFor.id, ids)}
            onCancel={() => setCollectionsFor(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {kitchenRecipe && (
          <KitchenMode key="kitchen" recipe={kitchenRecipe} onClose={() => setKitchenRecipe(null)} />
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors />
    </div>
  );
}
