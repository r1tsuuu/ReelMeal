// `DeviceFrame` is the React component (kept in DeviceFrameImpl.tsx so its
// filename doesn't shadow this barrel when Node/tsx resolves the bare path
// `@/components/DeviceFrame` — that shadowing would pull consumers through the
// CSS import and break non-browser test runners like tsx, which can't parse
// the stylesheet). `useDeviceFrame` comes from CSS-free ./FrameContext for the
// same reason.
export { DeviceFrame } from './DeviceFrameImpl';
export { useDeviceFrame } from './FrameContext';
export { useIsFramed, FRAME_BREAKPOINT_PX } from './useIsFramed';
