import assert from "node:assert/strict";
import test from "node:test";

import { runStressAudit, runStressCase } from "../src/geo-f2r/run-geo-f2r2.mjs";

test("GEO-F2R2 keeps training and evaluation identities disjoint", () => {
  const result = runStressAudit({ testSeeds: [100, 101], bootstrapReplicates: 12 });
  const disjointGate = result.gates.find((row) => row.check === "train_and_evaluation_identifiers_are_disjoint");
  assert.equal(disjointGate.measured, 1);
  assert.equal(result.summary.oracle_parameters_used_for_fit_or_interval_construction, false);
});

test("GEO-F2R2 is deterministic for a fixed seed and bootstrap budget", () => {
  const first = runStressCase(144, { bootstrapReplicates: 12 });
  const second = runStressCase(144, { bootstrapReplicates: 12 });
  assert.deepEqual(first, second);
});

test("GEO-F2R2 reports shorter arcs and higher contamination as stress boundaries", () => {
  const result = runStressAudit({ testSeeds: [100], bootstrapReplicates: 12 });
  assert.deepEqual(result.summary.declared_supported_arc_spans_degrees, [270, 210, 180]);
  assert.deepEqual(result.summary.stress_boundary_arc_spans_degrees, [150, 120, 90]);
  assert.ok(result.clusterRows.some((row) => row.contamination_rate > 0.10 && row.expected_region === "stress_boundary"));
});

test("GEO-F2R2 bootstrap output distinguishes validity, coverage, and width", () => {
  const entry = runStressCase(151, { bootstrapReplicates: 16 });
  assert.equal(entry.bootstraps.length, 2);
  for (const bootstrap of entry.bootstraps) {
    assert.ok(bootstrap.validFraction >= 0 && bootstrap.validFraction <= 1);
    assert.ok(bootstrap.coverageFraction >= 0 && bootstrap.coverageFraction <= 1);
    assert.ok(bootstrap.normalizedIntervalWidth >= 0);
    assert.equal(bootstrap.intervals.length, 5);
  }
});
