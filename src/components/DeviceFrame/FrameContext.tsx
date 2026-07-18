'use client';

import { createContext, useContext } from 'react';

// Extracted from DeviceFrame.tsx so consumers (KitchenMode, RecipeModal,
// ConfirmDialog, etc.) can import the hook WITHOUT transitively pulling in
// DeviceFrame.css — that CSS import breaks tsx-based tests (KitchenMode.test.mjs)
// because tsx tries to parse the stylesheet as JS. The provider side (DeviceFrame)
// still owns the CSS; this module is CSS-free.
//
// Overlays read this to know whether to anchor against the phone screen
// (`absolute`, true) or the browser viewport (`fixed`, false = today's behavior).
export const FrameContext = createContext(false);
export const useDeviceFrame = () => useContext(FrameContext);
