export interface Ingredient {
  name: string;
  amount: string;       // "1/2", "3", "to taste"
  unit: string;         // "cup", "tbsp", "grams", ""
}

export interface Collection {
  id: string;
  name: string;
}

export interface Recipe {
  id: string;            // MD5 hash of URL
  title: string;
  sourceUrl: string;
  extractedAt: string;   // ISO 8601
  servings: string;      // "2-4" or "4"
  prepTime: string;      // "15 mins"
  cookTime: string;      // "30 mins"
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];        // descriptive labels, e.g. "Chicken", "Quick" — drives the filter chips
  collections: string[]; // Collection ids this recipe is saved into. Empty = extracted but not saved.
  savedAt: string | null; // ISO timestamp of the last save; null if never saved.
}

export type LoadingStage = 'idle' | 'sharing' | 'fetching_stream' | 'transcribing_audio' | 'parsing_ai' | 'error';

export interface APIRequestPayload {
  url: string;
  useMock: boolean;
}

export interface APIResponsePayload {
  success: boolean;
  recipe?: Recipe;
  error?: string;
  modelUsed?: string;
}
