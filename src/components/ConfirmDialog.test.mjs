import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsconfig ships `jsx: "preserve"` (Next.js hands JSX to SWC's automatic
// runtime at build time). tsx/esbuild doesn't implement "preserve" for its own
// runtime transform, so it compiles ConfirmDialog.tsx's JSX with the CLASSIC
// runtime (`React.createElement`). ConfirmDialog.tsx is a 'use client'
// component using hooks and only imports named hooks (useEffect/useId/useRef),
// not the `React` default, so its transpiled JSX throws `React is not defined`
// unless a global `React` is in scope. We expose it here — purely in the test
// module, touching no frozen or shared file (ConfirmDialog.tsx, tsconfig.json).
globalThis.React = React;

// Component RENDER tests for ConfirmDialog using react-dom/server's
// renderToStaticMarkup. SSR does NOT run useEffect, so this exercises the pure
// initial-render path with zero side effects. Esc-key and focus effects are
// deferred by effects and are intentionally NOT covered here (matches
// KitchenMode.test.mjs's documented scope).
//
// React.createElement is used instead of JSX to avoid jsx-runtime config in
// .mjs. Labels/copy are inlined so the test is self-contained.

const props = {
  open: true,
  title: 'Remove "X" from your vault?',
  message: "This can't be undone.",
  confirmLabel: 'Remove',
  cancelLabel: 'Cancel',
  onConfirm: () => {},
  onCancel: () => {},
};

test('open=true renders title, message, cancel label, and confirm label', async () => {
  const { default: ConfirmDialog } = await import('./ConfirmDialog.tsx');
  const html = renderToStaticMarkup(React.createElement(ConfirmDialog, props));

  // Title text rendered into the heading. react-dom/server HTML-escapes text
  // content, so `"` -> `&quot;` and `'` -> `&#x27;`; we assert against the
  // escaped form (the deterministic SSR output).
  assert.match(html, /Remove &quot;X&quot; from your vault\?/);
  // Supporting body copy (apostrophe escaped to `&#x27;`).
  assert.match(html, /This can&#x27;t be undone\./);
  // Cancel label rendered as button text (`>Cancel<` pins it to element
  // content rather than matching an incidental substring elsewhere).
  assert.match(html, />Cancel</);
  // Confirm label rendered as button text. `>Remove<` is distinct from the
  // title's `>Remove "X"...` because it requires `Remove` immediately
  // followed by `<`.
  assert.match(html, />Remove</);
});

test('open=true exposes dialog role, aria-modal, and aria-labelledby', async () => {
  const { default: ConfirmDialog } = await import('./ConfirmDialog.tsx');
  const html = renderToStaticMarkup(React.createElement(ConfirmDialog, props));

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="[^"]+"/);
});

test('open=false renders nothing', async () => {
  const { default: ConfirmDialog } = await import('./ConfirmDialog.tsx');
  const html = renderToStaticMarkup(
    React.createElement(ConfirmDialog, { ...props, open: false })
  );

  // Early-return null -> renderToStaticMarkup emits the empty string.
  assert.equal(html, '');
  // Sanity: the title text is absent when closed.
  assert.doesNotMatch(html, /from your vault\?/);
});

test('module shape: default export is a function', async () => {
  const mod = await import('./ConfirmDialog.tsx');
  assert.equal(typeof mod.default, 'function');
});
