/**
 * Derives a short platform badge from a recipe's source URL. Presentational only —
 * intentionally not stored on Recipe since it's fully derivable from sourceUrl.
 */
export function getSourceLabel(sourceUrl: string): string {
  if (/instagram\.com/i.test(sourceUrl)) return 'IG';
  if (/tiktok\.com/i.test(sourceUrl)) return 'TT';
  if (/youtube\.com|youtu\.be/i.test(sourceUrl)) return 'YT';
  return 'WEB';
}
