'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Recipe, LoadingStage, APIResponsePayload } from '@/types/recipe';
import { STORAGE_KEY, API_ENDPOINT, LOADING_MESSAGES } from '@/utils/constants';
import { isValidInstagramUrl } from '@/utils/regex';
import RecipeCard from '@/components/RecipeCard';
import RecipeModal from '@/components/RecipeModal';
import KitchenMode from '@/components/KitchenMode';

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

  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [stage, setStage] = useState<LoadingStage>('idle');
  const [inputUrl, setInputUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [kitchenMode, setKitchenMode] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedRecipes(JSON.parse(raw));
    } catch {
      setSavedRecipes([]);
    }
  }, []);

  useEffect(() => {
    const shareUrl = searchParams.get('shareUrl');
    if (shareUrl) {
      setInputUrl(shareUrl);
      void handleExtract(shareUrl);
    }
    if (searchParams.get('error') === 'invalid_link') {
      setErrorMessage('Could not find an Instagram link in what was shared.');
      setStage('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        const next = [data.recipe, ...savedRecipes];
        setSavedRecipes(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
    const next = savedRecipes.filter((recipe) => recipe.id !== id);
    setSavedRecipes(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCurrentRecipe(null);
  }

  const isBusy = stage !== 'idle' && stage !== 'error';

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

        {savedRecipes.length === 0 ? (
          <p className="text-center text-charcoal/60">No recipes yet — paste a link above to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {savedRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setCurrentRecipe(recipe)} />
            ))}
          </div>
        )}
      </div>

      {currentRecipe && !kitchenMode && (
        <RecipeModal
          recipe={currentRecipe}
          onClose={() => setCurrentRecipe(null)}
          onKitchenMode={() => setKitchenMode(true)}
        />
      )}

      {kitchenMode && currentRecipe && (
        <KitchenMode recipe={currentRecipe} onClose={() => setKitchenMode(false)} />
      )}
    </main>
  );
}
