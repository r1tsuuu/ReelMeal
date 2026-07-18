/**
 * Pure helpers for KitchenMode step navigation and display.
 *
 * No React, no DOM, no `@/` alias — kept dependency-free so the `.mjs` test
 * can import this via a relative path under `tsx --test`.
 *
 * `total <= 0` is treated as the empty-instructions sentinel: navigation
 * becomes a no-op and progress/label render a safe empty state instead of
 * `NaN` / `Infinity` / "Step 1 of 0".
 */

/**
 * Clamp a step index into the valid range [0, total-1].
 * total <= 0 (or non-finite) → 0. Non-finite index → 0.
 */
export function clampStep(index: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), Math.trunc(total) - 1);
}

/** Index after a forward navigation, clamped to the last step. total <= 0 → 0. */
export function nextIndex(index: number, total: number): number {
  return clampStep(index + 1, total);
}

/** Index after a backward navigation, clamped to the first step. total <= 0 → 0. */
export function prevIndex(index: number, total: number): number {
  return clampStep(index - 1, total);
}

/**
 * Integer percent (0..100) of recipe completion at the given step.
 * total <= 0 → 0 (never NaN, never Infinity).
 * 1 of 5 → 20, 3 of 5 → 60, 5 of 5 → 100, 1 of 1 → 100.
 */
export function progressPercent(index: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const safe = clampStep(index, total);
  return Math.round(((safe + 1) / total) * 100);
}

/**
 * Header copy for the current step.
 * total >= 1 → "Step X of Y". total <= 0 → "No steps available".
 */
export function formatStepLabel(index: number, total: number): string {
  if (!Number.isFinite(total) || total <= 0) return 'No steps available';
  const safe = clampStep(index, total);
  return `Step ${safe + 1} of ${total}`;
}
