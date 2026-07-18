'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Recipe, Collection, LoadingStage, APIResponsePayload } from '@/types/recipe';
import { STORAGE_KEY, ONBOARDED_KEY, API_ENDPOINT, LOADING_MESSAGES, RECENT_LIMIT } from '@/utils/constants';
import { isValidInstagramUrl } from '@/utils/regex';
import { loadCollections, saveCollections } from '@/utils/collections';
import { useLongPress } from '@/hooks/useLongPress';
import RecipeCard from '@/components/RecipeCard';
import RecipeModal from '@/components/RecipeModal';
import KitchenMode from '@/components/KitchenMode';
import Onboarding from '@/components/Onboarding';
import FilterChips from '@/components/FilterChips';
import CollectionsModal from '@/components/CollectionsModal';
import DuplicateBanner from '@/components/DuplicateBanner';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

// Tap opens the recipe, long-press opens "save to collections" for it. Both
// gestures need to live on the same element to be told apart, so this wraps
// RecipeCard's own button in a div carrying the long-press handlers — the
// card's onClick is a no-op and the real dispatch happens here via bubbling.
function RecipeTile({ recipe, onOpen, onSave }: { recipe: Recipe; onOpen: () => void; onSave: () => void }) {
  const longPress = useLongPress(onSave, onOpen);
  return (
    <div {...longPress}>
      <RecipeCard recipe={recipe} onClick={() => {}} />
    </div>
  );
}

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [readyToRender, setReadyToRender] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [stage, setStage] = useState<LoadingStage>('idle');
  const [inputUrl, setInputUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [kitchenMode, setKitchenMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [collectionsTarget, setCollectionsTarget] = useState<Recipe | null>(null);
  const [duplicate, setDuplicate] = useState<Recipe | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedRecipes(JSON.parse(raw));
    } catch {
      setSavedRecipes([]);
    }
    setCollections(loadCollections());
    setOnboarded(window.localStorage.getItem(ONBOARDED_KEY) === '1');
    setReadyToRender(true);
  }, []);

  useEffect(() => {
    const shareUrl = searchParams.get('shareUrl');
    if (shareUrl) {
      setInputUrl(shareUrl);
      setStage('sharing');
      void handleExtract(shareUrl);
    }
    if (searchParams.get('error') === 'invalid_link') {
      setErrorMessage('Could not find an Instagram link in what was shared.');
      setStage('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function persist(next: Recipe[]) {
    setSavedRecipes(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function handleExtract(url: string) {
    if (!isValidInstagramUrl(url)) {
      setErrorMessage('Please paste a valid Instagram reel or post URL.');
      setStage('error');
      return;
    }

    setErrorMessage(null);
    setStage('fetching_stream');

    try {
      const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, useMock }),
      });
      const data: APIResponsePayload = await response.json();

      if (data.success && data.recipe) {
        const existing = savedRecipes.find((r) => r.sourceUrl === data.recipe!.sourceUrl);
        if (existing) {
          setDuplicate(existing);
        } else {
          persist([data.recipe, ...savedRecipes]);
        }
        setInputUrl('');
        setStage('idle');
        router.replace('/');
      } else {
        setErrorMessage(data.error ?? 'Something went wrong.');
        setStage('error');
      }
    } catch {
      setErrorMessage('Network error — check your connection and try again.');
      setStage('error');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleExtract(inputUrl);
  }

  function handleDelete(id: string) {
    persist(savedRecipes.filter((recipe) => recipe.id !== id));
    setCurrentRecipe(null);
  }

  function handleCreateCollection(name: string): string {
    const id = `${name.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const next = [...collections, { id, name: name.trim() }];
    setCollections(next);
    saveCollections(next);
    return id;
  }

  function handleCollectionsConfirm(selectedIds: string[]) {
    if (!collectionsTarget) return;
    const savedAt = new Date().toISOString();
    persist(savedRecipes.map((r) => (
      r.id === collectionsTarget.id ? { ...r, collections: selectedIds, savedAt } : r
    )));
    setCollectionsTarget(null);
  }

  const filteredRecipes = useMemo(() => {
    if (activeFilter === 'all') return savedRecipes;
    if (activeFilter === 'recent') return savedRecipes.slice(0, RECENT_LIMIT);
    return savedRecipes.filter((r) => r.tags.includes(activeFilter));
  }, [savedRecipes, activeFilter]);

  const isBusy = stage !== 'idle' && stage !== 'error';

  if (!readyToRender) return null;

  if (!onboarded) {
    return (
      <Onboarding
        onFinish={() => {
          window.localStorage.setItem(ONBOARDED_KEY, '1');
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-charcoal">ReelMeal</h1>

        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste Instagram Reel URL"
            className="flex-1 rounded-lg border border-charcoal/20 bg-white px-4 py-3 text-charcoal"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-lg bg-terracotta px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Extract Recipe
          </button>
        </form>

        {stage !== 'idle' && (
          <p className={`mb-6 rounded-lg px-4 py-2 text-sm ${stage === 'error' ? 'bg-red-100 text-red-700' : 'bg-sage/20 text-charcoal'}`}>
            {stage === 'error' ? errorMessage : LOADING_MESSAGES[stage]}
          </p>
        )}

        <FilterChips recipes={savedRecipes} activeFilter={activeFilter} onSelect={setActiveFilter} />

        {duplicate && (
          <DuplicateBanner
            title={duplicate.title}
            onView={() => {
              setCurrentRecipe(duplicate);
              setDuplicate(null);
            }}
            onDismiss={() => setDuplicate(null)}
          />
        )}

        {savedRecipes.length === 0 ? (
          <p className="text-center text-charcoal/60">No recipes yet — paste a link above to get started.</p>
        ) : filteredRecipes.length === 0 ? (
          <p className="text-center text-charcoal/60">No recipes match this filter.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <RecipeTile
                key={recipe.id}
                recipe={recipe}
                onOpen={() => setCurrentRecipe(recipe)}
                onSave={() => setCollectionsTarget(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {collectionsTarget && (
        <CollectionsModal
          collections={collections}
          initialSelected={collectionsTarget.collections}
          onCreateCollection={handleCreateCollection}
          onConfirm={handleCollectionsConfirm}
          onCancel={() => setCollectionsTarget(null)}
        />
      )}

      {currentRecipe && !kitchenMode && (
        <RecipeModal
          recipe={currentRecipe}
          onClose={() => setCurrentRecipe(null)}
          onKitchenMode={() => setKitchenMode(true)}
          onDelete={() => handleDelete(currentRecipe.id)}
        />
      )}

      {kitchenMode && currentRecipe && (
        <KitchenMode recipe={currentRecipe} onClose={() => setKitchenMode(false)} />
      )}
    </main>
  );
}
