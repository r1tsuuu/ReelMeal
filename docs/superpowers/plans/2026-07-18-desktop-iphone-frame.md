# Desktop iPhone Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On viewports ≥768px, render the entire ReelMeal app inside a CSS-only iPhone frame on an ambient dark background, with all overlays constrained to the phone screen; below 768px, the app is byte-for-byte unchanged.

**Architecture:** A single `<DeviceFrame>` wrapper component detects viewport width (`useIsFramed`) and, when framed, renders children inside a `.df-screen` container (the phone screen). A React context (`useDeviceFrame`) lets overlays switch their root positioning from `fixed` → `absolute` so they anchor to `.df-screen` instead of the browser viewport. No portals, no restructuring — the page tree stays identical; only CSS classes flip conditionally.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS 3, TypeScript. No new dependencies. The app already uses `motion/react` (framer-motion) and `lucide-react`; this plan adds neither.

**Spec:** `docs/superpowers/specs/2026-07-18-desktop-iphone-frame-design.md`

## Global Constraints

- **This is a temporary, revertible feature.** Branch is `feature/desktop-iphone-frame-temporary`. All new code lives in `src/components/DeviceFrame/`; existing-file edits must stay minimal and easily revertible.
- **Mobile/narrow view is sacrosanct.** Below 768px the render path must be byte-identical to today. The `<DeviceFrame>` passthrough returns `<>{children}</>` with zero added DOM.
- **Breakpoint:** `min-width: 768px` (Tailwind `md`). Defined once in `FRAME_BREAKPOINT_PX` and used in both the JS hook and the CSS media query.
- **No new dependencies.** No icon/image assets. The frame is pure CSS using existing palette vars (`--charcoal`, `--terracotta`) from `globals.css`.
- **No hydration mismatch.** SSR/initial client render must produce identical markup. The framed state initializes `false` (matching SSR) and is corrected in a `useEffect`; the ambient background fades in to mask the one-frame desktop flash.
- **Existing tests must keep passing:** `npm test` (runs `src/app/api/extract/route.test.mjs`, `src/components/kitchenUtils.test.mjs`, `src/components/KitchenMode.test.mjs`).
- **Existing color palette (from `globals.css`):** `--cream #f8f4ec`, `--cream-deep #f1ead9`, `--charcoal #3c3a37`, `--terracotta #d9714e`, `--sage #6f8a5f`.

---

## File Structure

**New (all under one directory — `rm -rf` to remove the feature):**

| File | Responsibility |
|---|---|
| `src/components/DeviceFrame/DeviceFrame.tsx` | The wrapper. Exports `DeviceFrame` (component) and `useDeviceFrame` (context hook). |
| `src/components/DeviceFrame/useIsFramed.ts` | Viewport-width hook. Exports `FRAME_BREAKPOINT_PX` and `useIsFramed`. |
| `src/components/DeviceFrame/DeviceFrame.css` | All frame styling: ambient bg, phone body, Dynamic Island, side buttons, screen container. Scoped under `.df-*` prefixes. |
| `src/components/DeviceFrame/index.ts` | Barrel re-export of `DeviceFrame` and `useDeviceFrame`. |

**Modified (minimal, revertible):**

| File | Change |
|---|---|
| `src/app/page.tsx` | Wrap both return paths (`<Onboarding>` and the dashboard `<div>`) in `<DeviceFrame>`. |
| `src/app/globals.css` | One `@import` line for `DeviceFrame.css` at the end. |
| `src/components/RecipeModal.tsx` | Root `motion.div`: `fixed` → conditional `absolute` when framed. |
| `src/components/CollectionsModal.tsx` | Same pattern. |
| `src/components/AddRecipeSheet.tsx` | Same pattern. |
| `src/components/KitchenMode.tsx` | Same pattern on **both** `fixed inset-0` roots (empty-state + main). |
| `src/components/ConfirmDialog.tsx` | Same pattern. |
| `src/components/Onboarding.tsx` | Root div: `min-h-dvh` → `min-h-full` when framed (so it fills `.df-screen`, not the desktop viewport). |

**Not modified:** `src/app/api/extract/*`, `src/types/recipe.ts`, any utils, any hooks, the FAB inside `page.tsx` (it's a child of the dashboard div, which is already inside `<DeviceFrame>`; its `fixed` positioning will be handled by the screen container's `overflow: hidden` + the same context — see Task 7).

---

## Task Decomposition Rationale

Eight tasks, ordered so each one is independently verifiable:

1. **Hook** (detection primitive) — no UI, no risk.
2. **Component shell + CSS** — frame appears on desktop but wraps nothing meaningful yet.
3. **Integration** — wire it into `page.tsx`; dashboard now framed on desktop.
4–7. **Overlays** (one task each, or batched by similarity) — make overlays stay inside the frame.
8. **Verification + commit** — full manual sweep on desktop and mobile.

The detection hook (Task 1) and the wrapper (Task 2) come first because every overlay task depends on `useDeviceFrame()` existing. Integration (Task 3) before overlays means you can see the dashboard framed and watch each overlay break out, then fix them one by one — clear before/after for each overlay task.

---

## Task 1: `useIsFramed` detection hook

**Files:**
- Create: `src/components/DeviceFrame/useIsFramed.ts`

**Interfaces:**
- Produces: `export const FRAME_BREAKPOINT_PX = 768;` and `export function useIsFramed(): boolean`

- [ ] **Step 1: Write the hook**

Create `src/components/DeviceFrame/useIsFramed.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

// Single source of truth for the desktop-frame breakpoint. Must match the
// media query in DeviceFrame.css. 768px = Tailwind's `md`; below it, phones
// dominate and the app renders fullscreen (unchanged from pre-frame behavior).
export const FRAME_BREAKPOINT_PX = 768;

// SSR-safe: initial state is `false` so the server render and the first client
// render produce identical markup (no hydration mismatch). The effect corrects
// to the real viewport width after mount. On desktop the frame fades in via a
// CSS transition on .df-ambient, masking the one-frame flash.
export function useIsFramed(): boolean {
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${FRAME_BREAKPOINT_PX}px)`);
    const update = () => setFramed(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return framed;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (file is new, not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add src/components/DeviceFrame/useIsFramed.ts
git commit -m "feat(frame): add useIsFramed viewport-detection hook"
```

---

## Task 2: `DeviceFrame` component + CSS

**Files:**
- Create: `src/components/DeviceFrame/DeviceFrame.tsx`
- Create: `src/components/DeviceFrame/DeviceFrame.css`
- Create: `src/components/DeviceFrame/index.ts`
- Modify: `src/app/globals.css` (append one `@import`)

**Interfaces:**
- Consumes: `useIsFramed`, `FRAME_BREAKPOINT_PX` from Task 1.
- Produces:
  - `export function DeviceFrame({ children }: { children: ReactNode }): JSX.Element`
  - `export function useDeviceFrame(): boolean` — returns `true` only when rendered inside an active frame's `.df-screen`. Overlays read this to decide `absolute` vs `fixed`.

- [ ] **Step 1: Write the CSS**

Create `src/components/DeviceFrame/DeviceFrame.css`. All rules scoped under `.df-*` so nothing leaks into the rest of the app. The frame is invisible below the breakpoint (no rules match) — mobile CSSOM stays clean.

```css
/* Desktop iPhone frame — temporary feature. See docs/superpowers/specs/2026-07-18-desktop-iphone-frame-design.md */

@media (min-width: 768px) {
  /* Ambient backdrop: dark with a soft terracotta glow centered on the phone.
     Fade-in masks the one-frame detection flash on desktop. */
  .df-ambient {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(circle at 50% 40%, rgba(217, 113, 78, 0.18), transparent 55%),
      radial-gradient(circle at 30% 75%, rgba(111, 138, 95, 0.10), transparent 50%),
      #0d0d10;
    box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.7); /* vignette */
    animation: df-fade-in 200ms ease-out;
  }

  @keyframes df-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* The device body. Portrait iPhone proportions (390x844 logical), capped to
     90vh so it fits on short laptop screens. */
  .df-phone {
    position: relative;
    width: 390px;
    height: min(844px, 90vh);
    background: linear-gradient(145deg, #1a1a1a, #000);
    border-radius: 46px;
    padding: 12px; /* the bezel */
    box-shadow:
      0 30px 80px rgba(0, 0, 0, 0.75),
      0 0 0 2px #2a2a2a,
      inset 0 0 2px #3a3a3a;
  }

  /* Dynamic Island pill, centered at the top of the screen. z-index keeps it
     above app content but below overlays (overlays start at z-40). */
  .df-island {
    position: absolute;
    top: 11px;
    left: 50%;
    transform: translateX(-50%);
    width: 100px;
    height: 30px;
    background: #000;
    border-radius: 18px;
    z-index: 35; /* below RecipeModal (z-40) so modals cover it when open */
  }

  /* Side buttons — decorative silhouettes on the device edges. */
  .df-phone::before {
    /* left edge: volume buttons (ring/silent switch + two volume keys) */
    content: '';
    position: absolute;
    left: -3px;
    top: 130px;
    width: 3px;
    height: 110px;
    background: #0a0a0a;
    border-radius: 2px 0 0 2px;
    box-shadow:
      0 130px 0 0 #0a0a0a; /* crude: a second segment lower down */
  }

  .df-phone::after {
    /* right edge: power button */
    content: '';
    position: absolute;
    right: -3px;
    top: 170px;
    width: 3px;
    height: 90px;
    background: #0a0a0a;
    border-radius: 0 2px 2px 0;
  }

  /* The screen — the app and all its overlays live in here. `position: relative`
     makes it the anchoring ancestor for overlays that switch to `absolute`.
     `overflow: hidden` clips app content to the rounded screen. */
  .df-screen {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--cream);
    border-radius: 36px;
    overflow: hidden;
  }
}
```

**Note on `::before` box-shadow trick:** the comment says "crude" intentionally — it draws a second segment below the first to suggest the mute switch + volume pair. If it looks wrong in Task 8's visual check, replace with two separate absolutely-positioned divs. Kept as pseudo-elements here to avoid extra DOM.

- [ ] **Step 2: Write the component**

Create `src/components/DeviceFrame/DeviceFrame.tsx`:

```tsx
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useIsFramed } from './useIsFramed';
import './DeviceFrame.css';

// Overlays read this to know whether to anchor against the phone screen
// (`absolute`, true) or the browser viewport (`fixed`, false = today's behavior).
const FrameContext = createContext(false);
export const useDeviceFrame = () => useContext(FrameContext);

interface DeviceFrameProps {
  children: ReactNode;
}

// When the viewport is narrow (< 768px), this is a pure passthrough: it renders
// children with zero added DOM, so the mobile experience is byte-identical to
// pre-frame behavior. When wide, it wraps children in the iPhone shell.
//
// REMOVAL: delete src/components/DeviceFrame/, revert the two <DeviceFrame>
// wrappers in page.tsx, drop the @import in globals.css. Nothing else to undo.
export function DeviceFrame({ children }: DeviceFrameProps) {
  const framed = useIsFramed();

  if (!framed) {
    return <>{children}</>;
  }

  return (
    <FrameContext.Provider value={true}>
      <div className="df-ambient">
        <div className="df-phone">
          <div className="df-island" />
          <div className="df-screen">{children}</div>
        </div>
      </div>
    </FrameContext.Provider>
  );
}
```

- [ ] **Step 3: Write the barrel**

Create `src/components/DeviceFrame/index.ts`:

```ts
export { DeviceFrame, useDeviceFrame } from './DeviceFrame';
export { useIsFramed, FRAME_BREAKPOINT_PX } from './useIsFramed';
```

- [ ] **Step 4: Import the CSS once, globally**

Append to `src/app/globals.css` (after the existing `h4` rule, at the very end):

```css

/* Temporary desktop iPhone frame. Safe to delete with src/components/DeviceFrame/. */
@import './components/DeviceFrame/DeviceFrame.css';
```

Why global import and not the component's own `import './DeviceFrame.css'`? Both work, but a single `@import` in `globals.css` with an inline removal note makes the feature's revert a grep for "DeviceFrame" — one file to edit rather than hunting the component import. (The component's `import './DeviceFrame.css'` line in Step 2 can be removed when you do this; pick one approach. The plan keeps both for robustness — duplicate `@import` of the same file is a no-op in PostCSS.)

**Correction — pick exactly one to avoid confusion:** use the component-level `import` (already in Step 2) and **skip Step 4**. Do not add the `@import` to `globals.css`. The component's own import is sufficient and co-locates the CSS with its consumer. Update the revert note in `DeviceFrame.tsx`'s comment to drop the globals.css mention (already accurate — it only mentions `src/components/DeviceFrame/` and `page.tsx`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/DeviceFrame/DeviceFrame.tsx \
        src/components/DeviceFrame/DeviceFrame.css \
        src/components/DeviceFrame/index.ts
git commit -m "feat(frame): add DeviceFrame wrapper with CSS iPhone shell"
```

---

## Task 3: Integrate `<DeviceFrame>` into `page.tsx`

**Files:**
- Modify: `src/app/page.tsx` (wrap two return paths; add one import)

**Interfaces:**
- Consumes: `DeviceFrame` from `@/components/DeviceFrame`.

- [ ] **Step 1: Add the import**

In `src/app/page.tsx`, add to the import block (after the existing component imports, around line 20):

```tsx
import { DeviceFrame } from '@/components/DeviceFrame';
```

- [ ] **Step 2: Wrap the onboarding return**

Find the onboarding early-return (currently lines 179–188):

```tsx
  if (!onboarded) {
    return (
      <Onboarding
        onFinish={() => {
          window.localStorage.setItem(ONBOARDED_KEY, '1');
          setOnboarded(true);
        }}
      />
    );
  }
```

Replace with:

```tsx
  if (!onboarded) {
    return (
      <DeviceFrame>
        <Onboarding
          onFinish={() => {
            window.localStorage.setItem(ONBOARDED_KEY, '1');
            setOnboarded(true);
          }}
        />
      </DeviceFrame>
    );
  }
```

- [ ] **Step 3: Wrap the dashboard return**

Find the main dashboard return (currently starts at line 190 with `<div className="min-h-dvh bg-cream text-charcoal">` and ends at line 427 with `</div>`). Wrap it:

```tsx
  return (
    <DeviceFrame>
      <div className="min-h-dvh bg-cream text-charcoal">
        {/* …all existing dashboard content unchanged… */}
      </div>
    </DeviceFrame>
  );
```

**Do not change anything inside the `<div>`** — only add the wrapping `<DeviceFrame>` and its closing tag.

- [ ] **Step 4: Verify dev server renders the frame on desktop**

Run: `npm run dev`
Open `http://localhost:3000` on a desktop-width window (≥768px).
Expected:
- App renders inside a centered iPhone frame on a dark ambient background.
- Dynamic Island pill visible at top.
- Dashboard scrolls inside the phone screen.
- **Overlays will break out of the frame** at this point — that's expected; Tasks 4–7 fix them.

Then resize the window below 768px.
Expected: frame disappears, app fills the viewport as before (passthrough).

Then open Chrome DevTools mobile emulation (e.g. iPhone 14).
Expected: no frame, app fullscreen.

- [ ] **Step 5: Verify existing tests still pass**

Run: `npm test`
Expected: all three test files pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(frame): wrap dashboard + onboarding in DeviceFrame"
```

---

## Task 4: Constrain `RecipeModal` and `ConfirmDialog` to the frame

**Why these two together:** `ConfirmDialog` is rendered *inside* `RecipeModal` (line 217 of `RecipeModal.tsx`), and both use `fixed inset-0`. They're the same conceptual change and best verified together — opening a recipe and clicking delete exercises both.

**Files:**
- Modify: `src/components/RecipeModal.tsx` (root `motion.div` className, line 57)
- Modify: `src/components/ConfirmDialog.tsx` (root `div` className, line 63)

**Interfaces:**
- Consumes: `useDeviceFrame` from `@/components/DeviceFrame`.

- [ ] **Step 1: Update `RecipeModal`**

In `src/components/RecipeModal.tsx`:

Add the import (after the existing `import ConfirmDialog from './ConfirmDialog';` on line 8):

```tsx
import { useDeviceFrame } from '@/components/DeviceFrame';
```

Inside the component body, before the `return` (after `const [showConfirm, setShowConfirm] = useState(false);` on line 31), add:

```tsx
  const framed = useDeviceFrame();
```

Change the root `motion.div` className (line 57) from:

```tsx
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-charcoal/50 sm:items-center sm:p-4 sm:backdrop-blur-sm"
```

to:

```tsx
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-40 flex items-stretch justify-center bg-charcoal/50 sm:items-center sm:p-4 sm:backdrop-blur-sm`}
```

**Why this works:** When framed, `.df-screen` is the nearest `position: relative` ancestor, so `absolute inset-0` fills the phone screen. The `z-40` still applies. The inner `motion.div` (the card itself) uses `sm:h-[92vh]` — inside the phone screen this means 92% of the screen height, which is correct.

- [ ] **Step 2: Update `ConfirmDialog`**

In `src/components/ConfirmDialog.tsx`:

Add the import (after line 3, `import { useEffect, useId, useRef } from 'react';`):

```tsx
import { useDeviceFrame } from '@/components/DeviceFrame';
```

Inside the component (after line 31, `const cancelRef = useRef...`), add:

```tsx
  const framed = useDeviceFrame();
```

Change the root `div` className (line 63) from:

```tsx
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
```

to:

```tsx
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-[60] flex items-center justify-center bg-black/50 p-4`}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification on desktop**

Run: `npm run dev`, desktop-width window.
1. Click a recipe card → `RecipeModal` opens **inside** the phone screen (covers the screen, not the desktop).
2. Click the trash icon → `ConfirmDialog` opens **inside** the modal (still within the phone screen).
3. Cancel → dialog closes, modal stays.
4. Resize below 768px → both overlays behave as before (fixed to viewport).

- [ ] **Step 5: Commit**

```bash
git add src/components/RecipeModal.tsx src/components/ConfirmDialog.tsx
git commit -m "feat(frame): constrain RecipeModal + ConfirmDialog to phone screen"
```

---

## Task 5: Constrain `CollectionsModal` and `AddRecipeSheet` to the frame

**Why together:** Both are bottom-sheet-style overlays with identical root class structure (`fixed inset-0 z-50 flex items-end ... sm:items-center sm:p-4`). Same one-line edit.

**Files:**
- Modify: `src/components/CollectionsModal.tsx` (root `motion.div` className, line 47)
- Modify: `src/components/AddRecipeSheet.tsx` (root `motion.div` className, line 110)

**Interfaces:**
- Consumes: `useDeviceFrame` from `@/components/DeviceFrame`.

- [ ] **Step 1: Update `CollectionsModal`**

In `src/components/CollectionsModal.tsx`:

Add import after line 5 (`import { Collection } from '@/types/recipe';`):

```tsx
import { useDeviceFrame } from '@/components/DeviceFrame';
```

Inside the component, after line 24 (`const [newName, setNewName] = useState('');`), add:

```tsx
  const framed = useDeviceFrame();
```

Change root `motion.div` className (line 47) from:

```tsx
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 backdrop-blur-sm sm:items-center sm:p-4"
```

to:

```tsx
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-50 flex items-end justify-center bg-charcoal/40 backdrop-blur-sm sm:items-center sm:p-4"
```

- [ ] **Step 2: Update `AddRecipeSheet`**

In `src/components/AddRecipeSheet.tsx`:

Add import after line 8 (`import { isValidInstagramUrl } from '@/utils/regex';`):

```tsx
import { useDeviceFrame } from '@/components/DeviceFrame';
```

Inside the component, after line 43 (`const cancelledRef = useRef(false);`), add:

```tsx
  const framed = useDeviceFrame();
```

Change root `motion.div` className (line 110) from:

```tsx
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 backdrop-blur-sm sm:items-center sm:p-4"
```

to:

```tsx
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-50 flex items-end justify-center bg-charcoal/40 backdrop-blur-sm sm:items-center sm:p-4"
```

**Note on the bottom-sheet animation:** The sheet animates `y: '100%' → y: 0`. With `absolute`, `100%` now refers to `.df-screen`'s height (the phone screen), so the sheet still rises from the bottom *of the phone*. Correct behavior.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification on desktop**

Run: `npm run dev`, desktop-width window.
1. Long-press a recipe card → `CollectionsModal` slides up **inside** the phone screen.
2. Tap the floating "+" button → `AddRecipeSheet` slides up **inside** the phone screen.
3. Both dismiss correctly; both stay within the screen bounds (no overflow onto the bezel).
4. Resize below 768px → both behave as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/CollectionsModal.tsx src/components/AddRecipeSheet.tsx
git commit -m "feat(frame): constrain CollectionsModal + AddRecipeSheet to phone screen"
```

---

## Task 6: Constrain `KitchenMode` to the frame

**Why separate:** `KitchenMode` has **two** `fixed inset-0` roots (empty-state at line 73, main at line 98), plus a `document.body.style.overflow = 'hidden'` side effect. It's also `z-[60]` and visually maximal (full-screen charcoal) — getting it wrong is the most noticeable. Deserves its own task and verification.

**Files:**
- Modify: `src/components/KitchenMode.tsx` (two root classNames: lines 73 and 98)

**Interfaces:**
- Consumes: `useDeviceFrame` from `@/components/DeviceFrame`.

- [ ] **Step 1: Add import and hook**

In `src/components/KitchenMode.tsx`:

Add import after line 7 (`import { clampStep, ... } from './kitchenUtils';`):

```tsx
import { useDeviceFrame } from '@/components/DeviceFrame';
```

Inside the component, after line 19 (`const [confirming, setConfirming] = useState(false);`), add:

```tsx
  const framed = useDeviceFrame();
```

- [ ] **Step 2: Update the empty-state root (line 73)**

Change from:

```tsx
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-charcoal text-white">
```

to:

```tsx
      <div className={`${framed ? 'absolute' : 'fixed'} inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-charcoal text-white">
```

- [ ] **Step 3: Update the main root (line 98)**

Change from:

```tsx
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-charcoal text-white"
```

to:

```tsx
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-[60] flex flex-col overflow-hidden bg-charcoal text-white"
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification on desktop**

Run: `npm run dev`, desktop-width window.
1. Open a recipe → "Start Kitchen Mode" → Kitchen Mode fills the **phone screen** (not the desktop). Charcoal background covers only the screen area; the device bezel and ambient bg remain visible around it.
2. Arrow keys / "Next" button navigate steps (the desktop controls are `hidden sm:flex`, and `sm:` is 640px which is true at desktop width, so they show — correct).
3. Press Esc → exit confirmation appears **inside** Kitchen Mode (it's `absolute inset-0` within Kitchen Mode's root, which is already inside `.df-screen`).
4. Exit → returns to recipe modal, still inside the phone.
5. Test the empty-state path: temporarily render `<KitchenMode recipe={{ ...recipe, instructions: [] }} />` (or find a recipe with no instructions) → empty-state renders inside the phone screen.
6. Resize below 768px → Kitchen Mode is fixed to viewport (fullscreen) as before.

**Revert the empty-state test recipe before committing if you fabricated one.**

- [ ] **Step 6: Verify existing KitchenMode test still passes**

Run: `npm test`
Expected: `KitchenMode.test.mjs` and `kitchenUtils.test.mjs` still pass (they test logic, not positioning).

- [ ] **Step 7: Commit**

```bash
git add src/components/KitchenMode.tsx
git commit -m "feat(frame): constrain KitchenMode (both roots) to phone screen"
```

---

## Task 7: Constrain `Onboarding` to the frame

**Why separate:** `Onboarding` is the one overlay that does **not** use `fixed inset-0` — it uses `min-h-dvh`, which means "minimum height = dynamic viewport height." Inside the frame, `100dvh` would mean the *desktop* viewport height, overflowing the phone screen. It needs `min-h-full` instead (fill `.df-screen`).

**Files:**
- Modify: `src/components/Onboarding.tsx` (root `div` className, line 34)

**Interfaces:**
- Consumes: `useDeviceFrame` from `@/components/DeviceFrame`.

- [ ] **Step 1: Add import and hook**

In `src/components/Onboarding.tsx`:

Add import after line 5 (`import { BookOpen, Share2 } from 'lucide-react';`):

```tsx
import { useDeviceFrame } from '@/components/DeviceFrame';
```

Inside the component, after line 29 (`const isLast = step === slides.length - 1;`), add:

```tsx
  const framed = useDeviceFrame();
```

- [ ] **Step 2: Update the root className (line 34)**

Change from:

```tsx
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-cream px-8 text-center">
```

to:

```tsx
    <div className={`relative flex ${framed ? 'min-h-full' : 'min-h-dvh'} flex-col items-center justify-center gap-6 overflow-hidden bg-cream px-8 text-center`}>
```

**Why `min-h-full`:** When framed, `.df-screen` is the positioning context and has a fixed height (the phone screen). `min-h-full` makes Onboarding fill that container. When not framed, `min-h-dvh` is unchanged (today's behavior).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification on desktop**

The onboarding only shows for first-time users. To test without clearing your own localStorage: open DevTools → Application → Local Storage → delete the `reelmeal-onboarded` key, then refresh.

1. On a desktop-width window, onboarding renders **inside** the phone screen, vertically centered within the screen area (not the desktop).
2. Both slides display correctly; CTA buttons are tappable.
3. Complete onboarding → dashboard appears, still framed.
4. Resize below 768px (with onboarding still showing) → onboarding fills the viewport as before.

Re-set `reelmeal-onboarded` in localStorage when done if you want to skip it going forward.

- [ ] **Step 5: Commit**

```bash
git add src/components/Onboarding.tsx
git commit -m "feat(frame): constrain Onboarding to phone screen (min-h-full when framed)"
```

---

## Task 8: Full verification + handle FAB + final commit

**Goal:** Catch anything missed. Specifically verify the floating "Add recipe" button (FAB), which uses `fixed bottom-6 left-1/2` + a motion `x: '-50%'` transform, and was *not* modified in Tasks 4–7. Confirm whether it needs the same treatment.

**Files:**
- Possibly modify: `src/app/page.tsx` (FAB className, around line 367) — only if Step 2 shows it breaking.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all three test files pass.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (If lint flags the new inline template strings, that's expected style — the codebase already uses this pattern elsewhere; verify it matches existing conventions before "fixing.")

- [ ] **Step 3: Inspect the FAB on desktop**

Run: `npm run dev`, desktop-width window.
Observe the floating "+ Add recipe" button.

**Expected outcome:** The FAB uses `fixed bottom-6 left-1/2` — `left-1/2` is 50% of the *viewport*, and `fixed` anchors to the viewport. On desktop this means it's centered on the **desktop screen**, not the phone screen — it'll appear floating in the ambient area, not inside the phone. This is a bug to fix.

- [ ] **Step 4: Fix the FAB**

In `src/app/page.tsx`, the `Dashboard` component needs to know if it's framed. Add to the existing imports at the top:

```tsx
import { DeviceFrame, useDeviceFrame } from '@/components/DeviceFrame';
```

Inside `Dashboard`, near the other `useState` declarations (around line 50), add:

```tsx
  const framed = useDeviceFrame();
```

Find the FAB (around line 362–372):

```tsx
      <motion.button
        type="button"
        onClick={() => setAdding(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 left-1/2 z-30 flex items-center gap-2 rounded-full bg-terracotta px-5 py-4 text-white shadow-[0_10px_30px_rgba(217,113,78,0.4)] transition-colors hover:bg-terracotta-dark"
        style={{ fontWeight: 600, x: '-50%' }}
      >
```

Change `fixed` to conditional:

```tsx
        className={`${framed ? 'absolute' : 'fixed'} bottom-6 left-1/2 z-30 flex items-center gap-2 rounded-full bg-terracotta px-5 py-4 text-white shadow-[0_10px_30px_rgba(217,113,78,0.4)] transition-colors hover:bg-terracotta-dark`}
```

The `style={{ x: '-50%' }}` stays — it's a motion transform independent of positioning. With `absolute`, `left-1/2` is 50% of `.df-screen`, and `x: '-50%'` centers the button on that point. Correct.

- [ ] **Step 5: Full desktop verification sweep**

Run: `npm run dev`, desktop-width window (≥768px). Walk through every surface:

- [ ] Dashboard: framed, scrolls inside phone, FAB centered in phone.
- [ ] Click recipe card → RecipeModal inside phone.
- [ ] Trash icon → ConfirmDialog inside modal inside phone.
- [ ] "Start Kitchen Mode" → KitchenMode fills phone screen.
- [ ] Esc → exit confirm inside KitchenMode.
- [ ] Back to modal → Save/Unsave works.
- [ ] Long-press a card → CollectionsModal slides up inside phone.
- [ ] FAB "+" → AddRecipeSheet slides up inside phone.
- [ ] Clear `reelmeal-onboarded` in localStorage, refresh → Onboarding inside phone.
- [ ] Dynamic Island stays visible above dashboard; modals (z-40+) cover it correctly.
- [ ] No overlay ever spills onto the bezel or ambient background.

- [ ] **Step 6: Full mobile/narrow verification sweep**

Resize to < 768px (or DevTools mobile emulation, e.g. iPhone 14 Pro):

- [ ] No frame, no ambient background, no Dynamic Island.
- [ ] Dashboard fills viewport.
- [ ] Every overlay is `fixed` to viewport (fullscreen) as before.
- [ ] FAB is `fixed` to viewport bottom-center.
- [ ] KitchenMode is fullscreen.
- [ ] Onboarding is `min-h-dvh`.

- [ ] **Step 7: Cross-browser check (optional but recommended)**

If time permits, verify in both Chrome and Firefox at desktop width. The `matchMedia` + CSS approach is well-supported; this is a sanity check for the `::before` box-shadow side-button trick (Step 1 of Task 2), which is the most likely cross-browser variance.

- [ ] **Step 8: Final commit**

```bash
git add src/app/page.tsx
git commit -m "feat(frame): constrain floating Add-recipe button to phone screen"
```

- [ ] **Step 9: Summary**

The feature is complete on `feature/desktop-iphone-frame-temporary`. Do **not** merge yet — the user will decide when to deploy. Push the branch when ready:

```bash
git push -u origin feature/desktop-iphone-frame-temporary
```

---

## Self-Review

**Spec coverage:**
- ✅ Viewport-width detection (`min-width: 768px`) → Task 1 (`FRAME_BREAKPOINT_PX`), Task 2 (CSS media query).
- ✅ `<DeviceFrame>` wrapper + passthrough → Task 2.
- ✅ CSS-only iPhone frame (bezel, island, buttons, ambient bg) → Task 2.
- ✅ `useDeviceFrame` context for overlays → Task 2 (produced), Tasks 4–7 (consumed).
- ✅ Overlays stay inside frame → RecipeModal+ConfirmDialog (Task 4), CollectionsModal+AddRecipeSheet (Task 5), KitchenMode both roots (Task 6), Onboarding `min-h-dvh`→`min-h-full` (Task 7), FAB (Task 8).
- ✅ Integration in `page.tsx` (two return paths) → Task 3.
- ✅ Mobile/narrow unchanged → verified in Task 8 Step 6; passthrough in Task 2.
- ✅ Existing tests pass → checked in Tasks 3, 6, 8.
- ✅ No new deps, no assets → confirmed throughout.
- ✅ Temporary/revertible → all new code under `src/components/DeviceFrame/`; existing-file edits are one-line className flips + one-line imports + two wrapper tags.

**Placeholder scan:** none. Every step has concrete code, exact line numbers, exact commands.

**Type consistency:** `useDeviceFrame()` signature is `() => boolean`, consumed identically in all overlay tasks. `DeviceFrame` props `{ children: ReactNode }` matches Task 3 usage. `FRAME_BREAKPOINT_PX` is exported from Task 1 and referenced in the Task 2 CSS comment (value 768, matching the media query). `useIsFramed` imported in `DeviceFrame.tsx` matches its Task 1 export.

**One ambiguity resolved:** Task 2 Step 4 initially specified a globals.css `@import` then self-corrected to skip it (use the component-level import only). The plan flags this explicitly so the implementer doesn't do both.
