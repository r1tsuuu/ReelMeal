import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsconfig ships `jsx: "preserve"` (Next.js hands JSX to SWC's automatic
// runtime at build time). tsx/esbuild doesn't implement "preserve" for its own
// runtime transform, so it compiles KitchenMode.tsx's JSX with the CLASSIC
// runtime (`React.createElement`). KitchenMode.tsx only imports named hooks,
// not the `React` default, so its transpiled JSX throws `React is not defined`
// unless a global `React` is in scope. We expose it here — purely in the test
// module, touching no frozen or shared file (KitchenMode.tsx, tsconfig.json).
globalThis.React = React;

// Component RENDER tests for KitchenMode using react-dom/server's
// renderToStaticMarkup. SSR does NOT run useEffect, so this exercises the pure
// initial-render path (including the B1 empty-state early return) with zero
// side effects. Wake-lock visibilitychange and keydown handlers are deferred by
// effects and are intentionally NOT covered here.
//
// React.createElement is used instead of JSX to avoid jsx-runtime config in
// .mjs. Recipe literals are inlined (no mockData import) so the test is
// self-contained and sidesteps any `@/` alias-resolution question.

test('3-step recipe initial render: header, first instruction, hint, nav, close, progress width', async () => {
  const { KitchenMode } = await import('./KitchenMode.tsx');
  const recipe = {
    id: 't1',
    title: 'T',
    sourceUrl: 'u',
    extractedAt: '2026-01-01T00:00:00.000Z',
    servings: '2',
    prepTime: '5 mins',
    cookTime: '10 mins',
    ingredients: [{ name: 'Flour', amount: '1', unit: 'cup' }],
    instructions: ['Step one text.', 'Step two text.', 'Step three text.'],
  };
  const html = renderToStaticMarkup(
    React.createElement(KitchenMode, { recipe, onClose: () => {} })
  );

  // Header label: formatStepLabel(0, 3) -> "Step 1 of 3".
  assert.match(html, /Step 1 of 3/);
  // First instruction text rendered into the main step panel.
  assert.match(html, /Step one text\./);
  // Persistent mobile nav hint (always shown, not step-gated).
  assert.match(html, /Tap left or right to navigate/);
  // Touch-zone aria-labels for the prev/next nav halves.
  assert.match(html, /Previous step/);
  assert.match(html, /Next step/);
  // Close button aria-label.
  assert.match(html, /Close Kitchen Mode/);
  // Progress bar width flows from progressPercent(0, 3) =
  // Math.round((0+1)/3*100) = 33. (The task brief said 20%, but that is the
  // 5-step milestone, covered in its own test below. 3 steps -> width:33%.)
  assert.match(html, /width:33%/);
});

test('empty instructions (B1 fix): renders safe empty state, no NaN/Infinity/Step 1 of 0', async () => {
  const { KitchenMode } = await import('./KitchenMode.tsx');
  const recipe = {
    id: 't2',
    title: 'Empty',
    sourceUrl: 'u',
    extractedAt: '2026-01-01T00:00:00.000Z',
    servings: '1',
    prepTime: '',
    cookTime: '',
    ingredients: [],
    instructions: [],
  };
  const html = renderToStaticMarkup(
    React.createElement(KitchenMode, { recipe, onClose: () => {} })
  );

  assert.match(html, /This recipe has no instructions yet\./);
  assert.match(html, /Back to recipe/);
  // The B1 guard short-circuits before the label/progress math runs.
  assert.doesNotMatch(html, /Step 1 of 0/);
  assert.doesNotMatch(html, /Infinity/);
  assert.doesNotMatch(html, /NaN/);
});

test('module shape: named KitchenMode export is a function', async () => {
  const mod = await import('./KitchenMode.tsx');
  assert.equal(typeof mod.KitchenMode, 'function');
});

test('progressPercent 1-of-5 -> 20% milestone flows to progress bar through real render', async () => {
  const { KitchenMode } = await import('./KitchenMode.tsx');
  const recipe = {
    id: 't5',
    title: 'Five',
    sourceUrl: 'u',
    extractedAt: '2026-01-01T00:00:00.000Z',
    servings: '4',
    prepTime: '5 mins',
    cookTime: '20 mins',
    ingredients: [{ name: 'Salt', amount: '1', unit: 'tsp' }],
    instructions: ['A.', 'B.', 'C.', 'D.', 'E.'],
  };
  const html = renderToStaticMarkup(
    React.createElement(KitchenMode, { recipe, onClose: () => {} })
  );
  // progressPercent(0, 5) = Math.round((0+1)/5*100) = 20 — the documented
  // "1 of 5 -> 20" milestone, exercised end-to-end through the component's
  // real render (the task brief's width:20% figure).
  assert.match(html, /width:20%/);
  assert.match(html, /Step 1 of 5/);
});
