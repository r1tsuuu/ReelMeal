import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';

// Test seam: youtube-dl-exec/ffmpeg-static/fs are all resolved as static ESM
// imports, so `node:test`'s module mocking can't swap them per-test (the
// binding is fixed at first module evaluation, and route.ts's compiled module
// is cached across tests regardless of cache-busting import specifiers).
// Routing every call through this mutable object lets tests reassign
// individual entries directly instead — the same trick already used for
// `globalThis.fetch`. Lives in its own file because Next.js route handlers
// reject any export that isn't a recognized route field (GET/POST/config/etc).
export const dependencies = {
  youtubedl,
  ffmpegPath,
  mkdtemp,
  readFile,
  rm,
  execFileAsync: promisify(execFile),
};
