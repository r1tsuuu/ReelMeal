'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Search, LayoutGrid, List, ChefHat, BookMarked, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/app/components/ui/sonner';
import { Recipe, Collection } from '@/types/recipe';
import { STORAGE_KEY, ONBOARDED_KEY, RECENT_LIMIT } from '@/utils/constants';
import { loadCollections, saveCollections } from '@/utils/collections';
import { Onboarding } from '@/components/Onboarding';
import { RecipeCard } from '@/components/RecipeCard';
import { RecipeListItem } from '@/components/RecipeListItem';
import { FilterChips } from '@/components/FilterChips';
import { RecipeModal } from '@/components/RecipeModal';
import { CollectionsModal } from '@/components/CollectionsModal';
import { KitchenMode } from '@/components/KitchenMode';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { AddRecipeSheet } from '@/components/AddRecipeSheet';
import { DeviceFrame } from '@/components/DeviceFrame';

type View = 'grid' | 'list';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [readyToRender, setReadyToRender] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<View>('grid');

  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  const [kitchenRecipe, setKitchenRecipe] = useState<Recipe | null>(null);
  const [collectionsFor, setCollectionsFor] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingInitialUrl, setAddingInitialUrl] = useState('');
  const [duplicate, setDuplicate] = useState<Recipe | null>(null);
  // A freshly extracted recipe that hasn't been saved into any collection yet.
  // If the user leaves its detail view without saving, it's discarded.
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRecipes(JSON.parse(raw));
    } catch {
      setRecipes([]);
    }
    setCollections(loadCollections());
    setOnboarded(window.localStorage.getItem(ONBOARDED_KEY) === '1');
    setReadyToRender(true);
  }, []);

  // Android share-sheet flow: /shared cleans the URL and redirects here with
  // ?shareUrl=..., which opens the add sheet pre-filled and extracting.
  useEffect(() => {
    const shareUrl = searchParams.get('shareUrl');
    if (shareUrl) {
      setAddingInitialUrl(shareUrl);
      setAdding(true);
      router.replace('/');
    }
    if (searchParams.get('error') === 'invalid_link') {
      toast.error('Could not find a recipe link in what was shared.');
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function persist(next: Recipe[]) {
    setRecipes(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const filtered = useMemo(() => {
    let list = recipes;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (filter === 'recent') {
      list = list.slice(0, RECENT_LIMIT);
    } else if (filter !== 'all') {
      list = list.filter((r) => r.tags.includes(filter));
    }
    return list;
  }, [recipes, query, filter]);

  const createCollection = (name: string): string => {
    const id = `${name.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const next = [...collections, { id, name: name.trim() }];
    setCollections(next);
    saveCollections(next);
    return id;
  };

  const saveToCollections = (recipeId: string, ids: string[]) => {
    const savedAt = ids.length ? new Date().toISOString() : null;
    persist(recipes.map((r) => (r.id === recipeId ? { ...r, collections: ids, savedAt } : r)));
    setOpenRecipe((cur) => (cur && cur.id === recipeId ? { ...cur, collections: ids, savedAt } : cur));
    setCollectionsFor(null);
    if (ids.length) {
      setPendingRecipeId((cur) => (cur === recipeId ? null : cur));
      toast.success('Saved to your collections');
    } else {
      toast('Removed from collections');
    }
  };

  const unsaveRecipe = (recipeId: string) => {
    persist(recipes.map((r) => (r.id === recipeId ? { ...r, collections: [], savedAt: null } : r)));
    setOpenRecipe((cur) => (cur && cur.id === recipeId ? { ...cur, collections: [], savedAt: null } : cur));
    toast('Removed from your Vault');
  };

  const deleteRecipe = (recipeId: string) => {
    const removed = recipes.find((r) => r.id === recipeId);
    persist(recipes.filter((r) => r.id !== recipeId));
    setPendingRecipeId((cur) => (cur === recipeId ? null : cur));
    setOpenRecipe(null);
    toast.success('Recipe deleted', {
      description: removed?.title,
      action: removed
        ? {
            label: 'Undo',
            onClick: () => persist([removed, ...recipes.filter((r) => r.id !== removed.id)]),
          }
        : undefined,
    });
  };

  const handleExtracted = (recipe: Recipe) => {
    const existing = recipes.find((r) => r.sourceUrl === recipe.sourceUrl);
    setAdding(false);
    setAddingInitialUrl('');
    if (existing) {
      setDuplicate(existing);
      toast('This recipe is already in your Vault');
      return;
    }
    persist([recipe, ...recipes]);
    setOpenRecipe(recipe);
    setPendingRecipeId(recipe.id);
    toast.success('Recipe extracted', { description: recipe.title });
  };

  // Closing the detail view. A pending (freshly extracted, never-saved) recipe
  // is discarded if the user backs out without saving it into any collection.
  const closeRecipe = () => {
    if (openRecipe && pendingRecipeId === openRecipe.id) {
      const live = recipes.find((r) => r.id === openRecipe.id);
      const unsaved = live && live.collections.length === 0 && live.savedAt === null;
      if (unsaved) {
        persist(recipes.filter((r) => r.id !== openRecipe.id));
        toast('Recipe discarded');
      }
      setPendingRecipeId(null);
    }
    setOpenRecipe(null);
  };

  if (!readyToRender) return null;

  if (!onboarded) {
    return (
      <DeviceFrame>
        <Onboarding
          onFinish={() => {
            window.localStorage.setItem(ONBOARDED_KEY, '1');
            setOnboarded(true);
          }}
        />
      </DeviceFrame>
    );
  }

  return (
    <DeviceFrame>
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

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-3">
        {filtered.length === 0 ? (
          recipes.length === 0 ? (
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
                  <>Nothing matches "{query}". Try another search or filter.</>
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
          <motion.div layout className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <AnimatePresence>
        {adding && (
          <AddRecipeSheet
            key="add"
            initialUrl={addingInitialUrl}
            onClose={() => {
              setAdding(false);
              setAddingInitialUrl('');
            }}
            onExtracted={handleExtracted}
          />
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
            onConfirm={(ids) => saveToCollections(collectionsFor.id, ids)}
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
    </DeviceFrame>
  );
}
