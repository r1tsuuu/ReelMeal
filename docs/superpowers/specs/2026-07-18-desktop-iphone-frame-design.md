# Desktop iPhone Frame — Design Spec

**Date:** 2026-07-18
**Branch:** `feature/desktop-iphone-frame-temporary` (off `main` @ `f96fe16`)
**Status:** Approved (Option A — ambient), pre-implementation

---

## ⚠️ Temporary Feature

This entire feature is a **throwaway layer**. ReelMeal is ultimately a native
Android/iOS app; the phone frame exists only so the Vercel-hosted web build
looks intentional when a hackathon judge (or anyone) opens it on a laptop. When
the native app ships, this branch should be reverted in full. The branch name
(`-temporary`) and a single integration point in `page.tsx` are deliberately
chosen so the revert is one PR.

**Removal criteria:** delete `src/components/DeviceFrame/`, revert the one
`<DeviceFrame>` wrapper in `page.tsx`, and drop the few CSS rules added to
`globals.css`. No backend, type, or state changes to undo.

---

## Goal

When the deployed web app is viewed on a **wide viewport** (desktop / laptop),
the entire app renders inside a realistic iPhone-shaped frame, centered on an
ambient dark background — so it reads as "this is a mobile app, here's a
preview" rather than a stretched-out web page.

When viewed on a **narrow viewport** (actual phone, or a desktop window resized
narrow), the app is **unchanged** — fullscreen, exactly as it is today. No frame.

This is purely presentational. Zero changes to backend, types, state machine,
API, persistence, or business logic.

---

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| **Detection** | Viewport width via CSS media query (`min-width: 768px`). No JS UA sniffing, no flicker, no server logic. |
| **Frame style** | Realistic iPhone via pure CSS — rounded bezel, Dynamic-Island pill, side-button silhouettes. No image assets. |
| **Overlays** | Stay **inside** the frame. Modals, sheets, Kitchen Mode, onboarding must not break out of the phone screen on desktop. |
| **Surround** | Option A — ambient. Just a dark/blurred background around the phone. No nav bar, no marketing text, no install buttons. |
| **Approach** | One wrapper component (`<DeviceFrame>`); overlays opt into frame-constrained positioning via a context. |

---

## Architecture

### New: `src/components/DeviceFrame/`

A small, self-contained directory so removal is a single `rm -rf`:

```
src/components/DeviceFrame/
├── DeviceFrame.tsx        # The wrapper. Provider + visual shell.
├── DeviceFrame.css        # iPhone bezel/island/buttons/ambient bg (desktop only)
├── useIsFramed.ts         # Viewport-width hook (the detection primitive)
├── useDeviceFrame.ts      # Context hook: overlays read this to know if framed
└── index.ts               # Re-exports
```

### `DeviceFrame.tsx` — the wrapper

```tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useIsFramed } from './useIsFramed';
import './DeviceFrame.css';

const FrameContext = createContext(false);
export const useDeviceFrame = () => useContext(FrameContext);

export function DeviceFrame({ children }: { children: ReactNode }) {
  const framed = useIsFramed();  // viewport-width hook, see below

  if (!framed) {
    // Passthrough — mobile/narrow view. Zero DOM overhead, identical to today.
    return <>{children}</>;
  }

  return (
    <FrameContext.Provider value={true}>
      <div className="df-ambient">           {/* dark/blurred backdrop */}
        <div className="df-phone">            {/* the device body */}
          <div className="df-island" />       {/* Dynamic Island pill */}
          {/* side buttons are ::before/::after on .df-phone, no extra DOM */}
          <FrameContext.Provider value={true}>
            <div className="df-screen">        {/* the "screen" — app lives here */}
              {children}
            </div>
          </FrameContext.Provider>
        </div>
      </div>
    </FrameContext.Provider>
  );
}
```

### `useIsFramed.ts` — detection

```tsx
'use client';
import { useState, useEffect } from 'react';

// Single source of truth for the breakpoint. Must match the CSS media query
// in DeviceFrame.css. 768px = Tailwind's `md`; below it phones dominate.
export const FRAME_BREAKPOINT_PX = 768;

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

**Why a hook + initial `false`, not SSR-detected:** avoids hydration mismatch
(server can't know viewport width). Initial render is unframed (matches mobile
/ SSR HTML), then the effect corrects to framed on desktop. The flash is one
frame on desktop only and is visually masked by the ambient background fading
in (CSS transition on `.df-ambient`).

---

## How overlays stay inside the frame

This is the hardest part. Today every overlay uses `position: fixed; inset: 0`,
which anchors to the **browser viewport** — on desktop that means they'd cover
the whole screen and break the illusion.

### The contract

Overlays read `useDeviceFrame()`. When framed:
- their root switches from `fixed inset-0` to `absolute inset-0`
- they render **inside `.df-screen`** (which is `position: relative;
  overflow: hidden`, sized to the phone screen)

Since all overlays are already rendered **inside** the dashboard `<div>` that
`<DeviceFrame>` wraps (see `page.tsx` — FAB, `AddRecipeSheet`, `RecipeModal`,
`CollectionsModal`, `KitchenMode`, `Toaster` are all children of the root
dashboard div), and `.df-screen` is their nearest positioned ancestor once
framed, `absolute inset-0` scopes them to the phone screen automatically. No
portal, no ref-passing, no restructuring of the page tree.

### Affected overlays

| Component | Current root class | Framed behavior |
|---|---|---|
| `RecipeModal` | `fixed inset-0 z-40` | `absolute inset-0` inside `.df-screen` |
| `CollectionsModal` | `fixed inset-0 z-50` | same |
| `AddRecipeSheet` | `fixed inset-0 z-50` (bottom sheet) | same — sheet still rises from bottom *of the phone screen* |
| `ConfirmDialog` | `fixed inset-0 z-[60]` | same |
| `KitchenMode` | `fixed inset-0 z-[60]` | same — full-screen cooking mode fills the phone screen, not the desktop |
| Floating "Add recipe" button | `fixed bottom-6 left-1/2` | reposition to `absolute` within `.df-screen`, keeps `bottom-6 left-1/2` |
| `Onboarding` | `min-h-dvh` (not fixed) | constrain to `.df-screen` height — uses `min-h-dvh` today; when framed, `.df-screen` is the new dvh |

### Implementation pattern for each overlay

Each overlay reads `useDeviceFrame()` and picks its root class:

```tsx
const framed = useDeviceFrame();
const rootPos = framed ? 'absolute' : 'fixed';
return <div className={`${rootPos} inset-0 z-40 ...`} />;
```

This is a one-line change per overlay (six overlays). It keeps the change
surgical and each overlay still works standalone (unframed = today's behavior).

---

## Integration point (the ONLY change to existing logic)

In `src/app/page.tsx`, the `Dashboard` return is wrapped:

```tsx
// before
return (
  <div className="min-h-dvh bg-cream text-charcoal">
    {/* header, main, FAB, overlays, Toaster */}
  </div>
);

// after
return (
  <DeviceFrame>
    <div className="min-h-dvh bg-cream text-charcoal">
      {/* header, main, FAB, overlays, Toaster — unchanged */}
    </div>
  </DeviceFrame>
);
```

**The `<Onboarding>` early-return path** also needs wrapping so first-run
users on desktop see the framed onboarding too:

```tsx
if (!onboarded) {
  return (
    <DeviceFrame>
      <Onboarding onFinish={...} />
    </DeviceFrame>
  );
}
```

That's the entire surface area of the change in `page.tsx`. Reverting the
feature = removing two `<DeviceFrame>` wrappers.

---

## Visual design (the frame itself)

CSS-only, no assets. Approximate values (final tuning in implementation):

| Part | Spec |
|---|---|
| **`.df-ambient`** (backdrop) | `position: fixed; inset: 0;` dark background: `radial-gradient(circle at 50% 40%, rgba(199,91,63,0.18), transparent 55%), #0d0d10`. Subtle vignette via inset box-shadow. Flex-centered. |
| **`.df-phone`** (device body) | Width `~390px` (iPhone 14/15 logical width), height `min(844px, 90vh)` so it fits laptop screens. `background: linear-gradient(145deg,#1a1a1a,#000)`. `border-radius: 46px`. Padding `12px` (the bezel). Layered box-shadow for depth + a `2px` ring. |
| **`.df-island`** (Dynamic Island) | `position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 100px; height: 30px; background: #000; border-radius: 18px; z-index: 5.` Sits above the screen content. |
| **Side buttons** | `::before` / `::after` on `.df-phone` — thin dark bars on the left (volume) and right (power) edges. Decorative. |
| **`.df-screen`** (app container) | `position: relative; width: 100%; height: 100%; border-radius: 36px; overflow: hidden;` — clips the app to the rounded screen. This is the overlays' positioning ancestor. |
| **Frame entrance** | `.df-ambient` fades in (`opacity 0 → 1`, ~200ms) to mask the one-frame detection flash on desktop. No animation on the app content itself. |

Colors reference the existing palette: terracotta `#C75B3F` glow, charcoal-adjacent
`#0d0d10` ambient. No new design tokens.

---

## What does NOT change

- `src/app/api/extract/*` — backend pipeline untouched.
- `src/types/recipe.ts` — no new fields.
- State machine, localStorage keys, share-target flow (`?shareUrl=`), PWA
  manifest/service worker.
- Mobile behavior at `< 768px` — byte-identical render path (passthrough).
- Tests — no new test surface. Existing tests (`route.test.mjs`,
  `KitchenMode.test.mjs`, `kitchenUtils.test.mjs`) unaffected; they test logic,
  not viewport presentation.

---

## Out of scope (YAGNI)

Explicitly **not** building:
- Marketing hero text, taglines, nav bars, install/GitHub buttons (Options B/C
  rejected).
- A manual framed/fullscreen toggle.
- User-Agent device sniffing.
- Tablet-specific tuning (tablets ≥768px get the frame; acceptable).
- Animations on app content, parallax, or 3D tilt of the phone.
- A landscape-orientation device frame (portrait only).
- Per-overlay "open inside frame" opt-out — all overlays are framed, uniformly.

---

## Failure modes

| Problem | Mitigation |
|---|---|
| Overlay uses `fixed` and breaks out of frame on desktop | Each overlay reads `useDeviceFrame()` — covered in implementation checklist; verify each manually on desktop. |
| Kitchen Mode `min-h-dvh` / wake-lock behaves oddly when constrained | KitchenMode already uses `fixed inset-0`; switching to `absolute inset-0` inside `.df-screen` keeps it full-phone-screen. Wake lock unaffected (it's a screen-level API, not layout). |
| `100dvh` inside frame double-counts with phone height | `.df-screen` uses `height: 100%` of the fixed-dimension `.df-phone`, not `dvh`. Overlays using `min-h-dvh` need to switch to `min-h-full` when framed (covered per-overlay). |
| Hydration mismatch / desktop flash | Initial state `framed = false` (matches SSR); effect corrects after mount; ambient bg fade masks it. |
| Judge resizes window across 768px during demo | `matchMedia` listener updates live; frame appears/disappears smoothly. Tested acceptable. |

---

## Implementation checklist (preview — full plan in writing-plans phase)

1. Create `src/components/DeviceFrame/` (`DeviceFrame.tsx`, `.css`,
   `useIsFramed.ts`, `index.ts`).
2. Wrap both return paths in `page.tsx` with `<DeviceFrame>`.
3. Update each of the 6 overlays to read `useDeviceFrame()` and switch
   `fixed → absolute` (+ `min-h-dvh → min-h-full` where relevant).
4. Reposition the floating "Add recipe" button inside the frame.
5. Manual desktop verification: dashboard, each overlay, Kitchen Mode,
   onboarding all render inside the phone and never break out.
6. Manual mobile/narrow verification: identical to current behavior.
7. Commit with reference to this spec; do not merge — feature branch stays
   open until ready to deploy.

---

## Open questions for implementation phase

(none blocking — all resolved during brainstorming)
