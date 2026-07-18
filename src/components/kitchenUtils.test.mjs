import assert from 'node:assert/strict';
import test from 'node:test';

// Mirrors src/app/api/extract/route.test.mjs: ESM .mjs, node:test +
// node:assert/strict, dynamic relative import of the .ts source (the `@/`
// alias does NOT resolve under tsx in .mjs).

test('clampStep returns 0 for total = 0', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  assert.equal(clampStep(0, 0), 0);
  assert.equal(clampStep(5, 0), 0);
  assert.equal(clampStep(-1, 0), 0);
});

test('clampStep clamps within [0, total-1]', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  assert.equal(clampStep(0, 5), 0);
  assert.equal(clampStep(4, 5), 4);
  assert.equal(clampStep(7, 5), 4);
  assert.equal(clampStep(-3, 5), 0);
});

test('clampStep single-step (total = 1)', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  assert.equal(clampStep(0, 1), 0);
  assert.equal(clampStep(2, 1), 0);
});

test('clampStep defends against NaN', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  assert.equal(clampStep(NaN, 5), 0);
  assert.equal(clampStep(2, NaN), 0);
});

test('nextIndex/prevIndex never escape bounds', async () => {
  const { nextIndex, prevIndex } = await import('./kitchenUtils.ts');
  assert.equal(nextIndex(3, 5), 4);
  assert.equal(nextIndex(4, 5), 4);
  assert.equal(prevIndex(0, 5), 0);
  assert.equal(prevIndex(2, 5), 1);
  // total = 0 → navigation is a no-op
  assert.equal(nextIndex(0, 0), 0);
  assert.equal(prevIndex(0, 0), 0);
});

test('progressPercent returns 0 for total <= 0 and is never NaN/Infinity', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  assert.equal(progressPercent(0, 0), 0);
  assert.equal(progressPercent(2, 0), 0);
  assert.equal(progressPercent(0, -3), 0);
  assert.equal(Number.isFinite(progressPercent(0, 0)), true);
});

test('progressPercent at 0/mid/100', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  assert.equal(progressPercent(0, 5), 20);
  assert.equal(progressPercent(2, 5), 60);
  assert.equal(progressPercent(4, 5), 100);
});

test('progressPercent single-step', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  assert.equal(progressPercent(0, 1), 100);
});

test('formatStepLabel "Step X of Y"', async () => {
  const { formatStepLabel } = await import('./kitchenUtils.ts');
  assert.equal(formatStepLabel(0, 5), 'Step 1 of 5');
  assert.equal(formatStepLabel(4, 5), 'Step 5 of 5');
});

test('formatStepLabel empty-state copy', async () => {
  const { formatStepLabel } = await import('./kitchenUtils.ts');
  assert.equal(formatStepLabel(0, 0), 'No steps available');
  assert.equal(formatStepLabel(5, 0), 'No steps available');
  assert.equal(formatStepLabel(0, -1), 'No steps available');
});

// ---------------------------------------------------------------------------
// Extended coverage (Dev 4, branch glm/dev4_kitchen_mode).
// The 10 tests above are the preserved baseline. Everything below targets the
// branches the baseline misses — Math.trunc on fractional index, Math.round on
// non-exact fractions, overflow-index clamping inside progressPercent /
// formatStepLabel — plus exhaustive-matrix and monotonicity property checks.
// ---------------------------------------------------------------------------

test('clampStep truncates fractional index toward zero (Math.trunc, floor-toward-zero)', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  assert.equal(clampStep(2.7, 5), 2);
  assert.equal(clampStep(2.9, 5), 2);
  assert.equal(clampStep(-0.5, 5), 0);   // Math.trunc(-0.5) = 0 -> clamped to 0
  assert.equal(clampStep(-1.5, 5), 0);   // Math.trunc(-1.5) = -1 -> clamped to 0
  assert.equal(clampStep(4.999, 5), 4);  // fractional below last step truncates down
});

test('clampStep negative total is the empty-instructions sentinel (returns 0)', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  assert.equal(clampStep(2, -3), 0);
  assert.equal(clampStep(0, -1), 0);
  assert.equal(clampStep(-5, -10), 0);
});

test('clampStep treats Infinity / -Infinity totals and indices as non-finite (returns 0)', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  // non-finite total -> 0 (Number.isFinite(Infinity) === false)
  assert.equal(clampStep(2, Infinity), 0);
  assert.equal(clampStep(2, -Infinity), 0);
  // non-finite index, valid total -> 0
  assert.equal(clampStep(Infinity, 5), 0);
  assert.equal(clampStep(-Infinity, 5), 0);
});

test('clampStep: exhaustive matrix stays in [0, total-1] for total 0..12, index -3..total+3', async () => {
  const { clampStep } = await import('./kitchenUtils.ts');
  for (let total = 0; total <= 12; total++) {
    const upper = Math.max(0, total - 1);
    for (let index = -3; index <= total + 3; index++) {
      const got = clampStep(index, total);
      assert.ok(
        got >= 0 && got <= upper,
        `clampStep(${index}, ${total}) = ${got} outside [0, ${upper}]`
      );
      assert.equal(
        Number.isInteger(got), true,
        `clampStep(${index}, ${total}) = ${got} is not an integer`
      );
    }
  }
});

test('progressPercent: exhaustive matrix is finite, integer, and within [0, 100]', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  for (let total = 0; total <= 12; total++) {
    for (let index = -3; index <= total + 3; index++) {
      const got = progressPercent(index, total);
      assert.equal(
        Number.isFinite(got), true,
        `progressPercent(${index}, ${total}) = ${got} is not finite`
      );
      assert.ok(
        got >= 0 && got <= 100,
        `progressPercent(${index}, ${total}) = ${got} outside [0, 100]`
      );
      assert.equal(
        Number.isInteger(got), true,
        `progressPercent(${index}, ${total}) = ${got} is not an integer`
      );
    }
  }
});

test('formatStepLabel: exhaustive matrix matches /Step \\d+ of \\d+/ or "No steps available"', async () => {
  const { formatStepLabel } = await import('./kitchenUtils.ts');
  const stepRe = /^Step \d+ of \d+$/;
  for (let total = 0; total <= 12; total++) {
    for (let index = -3; index <= total + 3; index++) {
      const got = formatStepLabel(index, total);
      if (total <= 0) {
        assert.equal(
          got, 'No steps available',
          `formatStepLabel(${index}, ${total}) = ${JSON.stringify(got)}`
        );
      } else {
        assert.ok(
          stepRe.test(got),
          `formatStepLabel(${index}, ${total}) = ${JSON.stringify(got)} does not match /Step \\d+ of \\d+/`
        );
      }
    }
  }
});

test('clampStep / progressPercent handle large totals (1,000,000) without overflow', async () => {
  const { clampStep, progressPercent } = await import('./kitchenUtils.ts');
  const BIG = 1000000;
  assert.equal(clampStep(5, BIG), 5);
  assert.equal(clampStep(BIG, BIG), BIG - 1); // last valid index is total-1
  assert.equal(clampStep(BIG + 50, BIG), BIG - 1); // overflow clamps down
  assert.equal(progressPercent(0, BIG), 0);   // Math.round((1/1e6) * 100) = 0
  assert.equal(progressPercent(BIG - 1, BIG), 100); // last step -> 100
});

test('nextIndex / prevIndex: never escape bounds across totals 0..6 (exhaustive)', async () => {
  const { nextIndex, prevIndex } = await import('./kitchenUtils.ts');
  for (let total = 0; total <= 6; total++) {
    const upper = Math.max(0, total - 1);
    for (let index = -3; index <= total + 3; index++) {
      const n = nextIndex(index, total);
      const p = prevIndex(index, total);
      assert.ok(
        n >= 0 && n <= upper,
        `nextIndex(${index}, ${total}) = ${n} outside [0, ${upper}]`
      );
      assert.ok(
        p >= 0 && p <= upper,
        `prevIndex(${index}, ${total}) = ${p} outside [0, ${upper}]`
      );
    }
  }
});

test('nextIndex is idempotent at the last step and no-op when total <= 0', async () => {
  const { nextIndex } = await import('./kitchenUtils.ts');
  assert.equal(nextIndex(4, 5), 4);   // already last -> stays
  assert.equal(nextIndex(0, 1), 0);   // single-step -> stays
  assert.equal(nextIndex(0, 0), 0);   // empty -> 0
  assert.equal(nextIndex(3, -2), 0);  // negative total -> 0
});

test('prevIndex is idempotent at the first step and no-op when total <= 0', async () => {
  const { prevIndex } = await import('./kitchenUtils.ts');
  assert.equal(prevIndex(0, 5), 0);   // already first -> stays
  assert.equal(prevIndex(0, 1), 0);   // single-step -> stays
  assert.equal(prevIndex(0, 0), 0);   // empty -> 0
  assert.equal(prevIndex(3, -2), 0);  // negative total -> 0
});

test('progressPercent is monotonic non-decreasing across steps 0..total-1 for a fixed total >= 1', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  for (let total = 1; total <= 12; total++) {
    let prev = -Infinity;
    for (let index = 0; index < total; index++) {
      const got = progressPercent(index, total);
      assert.ok(
        got >= prev,
        `progressPercent(${index}, ${total}) = ${got} < prev ${prev} (not monotonic)`
      );
      prev = got;
    }
    // last step is always saturated to 100%
    assert.equal(progressPercent(total - 1, total), 100);
    // first step is always strictly positive
    assert.ok(
      progressPercent(0, total) > 0,
      `progressPercent(0, ${total}) is not > 0`
    );
  }
});

test('progressPercent rounds via Math.round for non-exact fractions', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  assert.equal(progressPercent(0, 3), 33); // Math.round(33.33..)
  assert.equal(progressPercent(1, 3), 67); // Math.round(66.67..)
  assert.equal(progressPercent(2, 3), 100);
  assert.equal(progressPercent(0, 7), 14); // Math.round(14.29..)
  assert.equal(progressPercent(0, 6), 17); // Math.round(16.67..)
  assert.equal(progressPercent(1, 8), 25); // Math.round(25)
});

test('progressPercent clamps an out-of-range (overflow / underflow) index internally via clampStep', async () => {
  const { progressPercent } = await import('./kitchenUtils.ts');
  assert.equal(progressPercent(99, 5), 100);            // overflow -> last step -> 100
  assert.equal(progressPercent(-99, 5), 20);            // underflow -> first step -> round(1/5*100)=20
  assert.equal(progressPercent(1000000, 3), 100);       // huge overflow -> 100
  assert.equal(progressPercent(0.0, 5), 20);            // baseline sanity
});

test('formatStepLabel clamps an out-of-range (overflow / underflow) index internally via clampStep', async () => {
  const { formatStepLabel } = await import('./kitchenUtils.ts');
  assert.equal(formatStepLabel(99, 5), 'Step 5 of 5');          // overflow -> last
  assert.equal(formatStepLabel(-99, 5), 'Step 1 of 5');         // underflow -> first
  assert.equal(formatStepLabel(1000000, 3), 'Step 3 of 3');     // huge overflow -> last
  assert.equal(formatStepLabel(-1000000, 3), 'Step 1 of 3');    // huge underflow -> first
});

test('clampStep / progressPercent / formatStepLabel are mutually consistent on the same inputs', async () => {
  const { clampStep, progressPercent, formatStepLabel } = await import('./kitchenUtils.ts');
  // For any valid (index, total) with total >= 1, formatStepLabel's "X" must equal
  // clampStep+1 and progressPercent must equal Math.round(((clampStep+1)/total)*100).
  for (let total = 1; total <= 10; total++) {
    for (let index = -2; index <= total + 2; index++) {
      const safe = clampStep(index, total);
      assert.equal(
        progressPercent(index, total),
        Math.round(((safe + 1) / total) * 100),
        `progressPercent inconsistent with clampStep at (${index}, ${total})`
      );
      assert.equal(
        formatStepLabel(index, total),
        `Step ${safe + 1} of ${total}`,
        `formatStepLabel inconsistent with clampStep at (${index}, ${total})`
      );
    }
  }
});
