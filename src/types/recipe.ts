export interface Ingredient {
  name: string;
  amount: string; // "1/2", "3", "to taste"
  unit: string;   // "cup", "tbsp", "grams", ""
}

export interface Recipe {
  id: string;
  title: string;
  sourceUrl: string;
  extractedAt: string;   // ISO 8601
  servings: string;      // "2-4" or "4"
  prepTime: string;      // "15 mins"
  cookTime: string;      // "30 mins"
  ingredients: Ingredient[];
  instructions: string[]; // Ordered step array
}

export type LoadingStage = 'idle' | 'fetching_stream' | 'transcribing_audio' | 'parsing_ai' | 'error';

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
