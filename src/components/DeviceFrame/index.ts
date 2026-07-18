// `DeviceFrame` is the React component (in DeviceFrame.tsx). This barrel
// re-exports it, so consumers importing from here transitively pull
// DeviceFrame.css. `useDeviceFrame` is re-exported from ./FrameContext too, but
// for CSS-free access (e.g. modules run through tsx, which can't parse CSS),
// import it directly from './FrameContext' instead of via this barrel.
export { DeviceFrame } from './DeviceFrame';
export { useDeviceFrame } from './FrameContext';
export { useIsFramed, FRAME_BREAKPOINT_PX } from './useIsFramed';
