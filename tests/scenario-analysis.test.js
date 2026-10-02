const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../scenario-analysis.js');

test('what-if downtime follows the known 45-minute inventory exhaustion boundary', () => {
  for (const minute of [0, 30, 45, 60, 120]) {
    const result = A.compare(minute);
    assert.equal(result.baseline.downtimeMinutes, 75);
    assert.equal(result.intervention.downtimeMinutes, Math.max(0, minute - 45));
    assert.equal(result.avoidedDowntimeMinutes, 75 - Math.max(0, minute - 45));
    assert.equal(result.series[0].baselineOutput, 0);
    assert.equal(result.series.at(-1).interventionOutput, result.intervention.produced);
    assert.equal(result.series.at(-1).minute, 120);
  }
});

test('late replenishment reduces recoverable output; end-of-horizon action has no effect', () => {
  const early = A.compare(30), late = A.compare(60), end = A.compare(120);
  assert.ok(early.additionalOutput > late.additionalOutput && late.additionalOutput > 0);
  assert.equal(end.additionalOutput, 0);
  assert.deepEqual(end.baseline, end.intervention);
  assert.equal(end.interventionWithinHorizon, false);
  assert.deepEqual(A.compare(30), early);
});

test('what-if rejects invalid action times rather than silently omitting an intervention', () => {
  for (const minute of [-5, 125, 1, 2.5, NaN, Infinity, '30', null]) {
    assert.throws(() => A.compare(minute), /Время пополнения/);
  }
});
