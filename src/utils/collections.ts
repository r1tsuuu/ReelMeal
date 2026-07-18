import { Collection } from '@/types/recipe';
import { COLLECTIONS_KEY, DEFAULT_COLLECTION } from './constants';

export function loadCollections(): Collection[] {
  try {
    const raw = window.localStorage.getItem(COLLECTIONS_KEY);
    const parsed: Collection[] = raw ? JSON.parse(raw) : [];
    return parsed.some((c) => c.id === DEFAULT_COLLECTION.id) ? parsed : [DEFAULT_COLLECTION, ...parsed];
  } catch {
    return [DEFAULT_COLLECTION];
  }
}

export function saveCollections(collections: Collection[]) {
  window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}
