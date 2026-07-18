import { Collection } from '@/types/recipe';

export const STORAGE_KEY = 'reelmeal-vault';
export const COLLECTIONS_KEY = 'reelmeal-collections';
export const ONBOARDED_KEY = 'reelmeal-onboarded';
export const API_ENDPOINT = '/api/extract';

export const DEFAULT_COLLECTION: Collection = { id: 'saved', name: 'Saved' };
export const RECENT_LIMIT = 4;
export const LONG_PRESS_MS = 480;

export const COLORS = {
  terracotta: '#C75B3F',
  cream: '#F5E6D3',
  sage: '#87A878',
  charcoal: '#121212',
};

export const LOADING_MESSAGES: Record<string, string> = {
  idle: 'Ready to extract recipes',
  sharing: 'Processing your share…',
  fetching_stream: 'Downloading video...',
  transcribing_audio: 'Transcribing audio...',
  parsing_ai: 'Extracting recipe...',
  error: 'Something went wrong',
};
