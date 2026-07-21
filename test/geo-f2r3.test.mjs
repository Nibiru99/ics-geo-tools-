import assert from "node:assert/strict";
import test from "node:test";

import { runTemporalCase, runTemporalUncertaintyAudit } from "../src/geo-f2r/run-geo-f2r3.mjs";

test("GEO-F2R3 is deterministic for a fixed repeated-measurement trace", () => {
  const first = runTemporalCase(240, { bootstrapReplicates: 4 });
  const second = runTemporalCase(240, { bootstrapReplicates: 4 });
  assert.deepEqual(first, second);
});

test("GEO-F2R3 preserves unequal positive time gaps", () => {
  const trace = runTemporalCase(241, { bootstrapReplicates: 4 });
  assert.equal(trace.frames.length, 22);
  const gaps = trace.frames.slice(1).map((frame) => frame.deltaTime);
  assert.ok(gaps.every((gap) => gap > 0));
  assert.ok(new Set(gaps).size >= 5);
  assert.ok(trace.frames.every((frame, index) => index === 0 || frame.time > trace.frames[index - 1].time));
});

test("GEO-F2R3 contains one occlusion and one recovery crossing", () => {
  const trace = runTemporalCase(242, { bootstrapReplicates: 4 });
  const transitions = trace.frames.filter((frame) => frame.transitionLabel === 1);
  assert.equal(transitions.length, 2);
  assert.deepEqual(transitions.map((frame) => frame.supportState), [0, 1]);
});

test("GEO-F2R3 exports finite uncertainty while keeping failures visible", () => {
  const trace = runTemporalCase(243, { bootstrapReplicates: 4 });
  for (const frame of trace.frames) {
    assert.ok(Number.isFinite(frame.normalizedIntervalWidth));
    assert.ok(frame.normalizedIntervalWidth >= 0);
    assert.ok(frame.bootstrapValidFraction >= 0 && frame.bootstrapValidFraction <= 1);
    if (!frame.fitValid) {
      assert.equal(frame.residualP95, 1e9);
      assert.equal(frame.normalizedIntervalWidth, 1e6);
    }
  }
  assert.equal(trace.generatorParametersUsedForFitOrUncertainty, false);
});

test("GEO-F2R3 repeated frames are independent noisy measurements", () => {
  const trace = runTemporalCase(244, { bootstrapReplicates: 4 });
  assert.ok(new Set(trace.frames.map((frame) => frame.trainingNoiseScale)).size > 10);
  assert.ok(new Set(trace.frames.map((frame) => frame.arcSpanDegrees)).size > 10);
});

test("GEO-F2R3 compact audit satisfies the frozen structural gates", () => {
  const result = runTemporalUncertaintyAudit({ seeds: [200, 201], bootstrapReplicates: 6 });
  assert.equal(result.summary.status, "supported");
  assert.equal(result.summary.checks_passed, result.summary.checks_total);
  assert.equal(result.summary.transitions_per_trace, 2);
  assert.ok(result.summary.boundary_to_supported_uncertainty_ratio >= 2);
  assert.equal(result.summary.generator_parameters_used_for_fit_or_uncertainty, false);
});
