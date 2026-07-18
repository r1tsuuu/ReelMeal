import { LoadingStage } from '@/types/recipe';

export const STORAGE_KEY = 'reelmeal-vault';
export const API_ENDPOINT = '/api/extract';

export const COLORS = {
  terracotta: '#C75B3F',
  cream: '#F5E6D3',
  sage: '#87A878',
  charcoal: '#121212',
};

export const LOADING_MESSAGES: Record<LoadingStage, string> = {
  idle: 'Ready to extract recipes',
  fetching_stream: 'Downloading video...',
  transcribing_audio: 'Transcribing audio...',
  parsing_ai: 'Extracting recipe...',
  error: 'Something went wrong',
};
