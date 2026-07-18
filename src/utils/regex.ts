/**
 * Extracts canonical Instagram Reel URL from messy mobile share text.
 * Input: "Look at this! https://www.instagram.com/reel/C8XyZ/?igsh=MTZ1&other=param"
 * Output: "https://www.instagram.com/reel/C8XyZ/"
 */
export function extractInstagramUrl(sharedText: string): string | null {
  const urlRegex = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels)\/[a-zA-Z0-9_-]+)/i;
  const match = sharedText.match(urlRegex);
  if (!match) return null;
  return `${match[1].replace(/\/$/, '')}/`;
}

export function isValidInstagramUrl(url: string): boolean {
  return /instagram\.com\/(reel|reels|p)\//.test(url);
}
