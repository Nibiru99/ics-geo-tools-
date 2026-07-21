import assert from "node:assert/strict";
import test from "node:test";

import {
  addVertex,
  analyzeMask,
  cyclicThreeProgressions,
  finiteFieldThreeProgressions,
  intervalProgressions
} from "../src/ap-cert-0/progression-hypergraph.mjs";
import { runCertificate } from "../src/ap-cert-0/run-ap-cert-0.mjs";

test("domain constructors keep interval, cyclic, and finite-field APs separate", () => {
  assert.equal(intervalProgressions(5, 3).indexedEdges.length, 4);
  assert.equal(cyclicThreeProgressions(7).indexedEdges.length, 21);
  assert.equal(finiteFieldThreeProgressions(3, 2).indexedEdges.length, 12);
});

test("AP48 pressure collapses exactly to weighted occupancy", () => {
  const hypergraph = intervalProgressions(12, 3);
  for (let mask = 0n; mask < (1n << 12n); mask += 1n) {
    const analysis = analyzeMask(hypergraph, mask);
    assert.equal(analysis.legacyPressure, analysis.legacyOccupancy);
    assert.equal(analysis.legacyPressure, analysis.degreeWeightedOccupancy);
  }
});

test("completion gradient is the exact discrete derivative of H", () => {
  const hypergraph = intervalProgressions(10, 3);
  for (let mask = 0n; mask < (1n << 10n); mask += 1n) {
    const analysis = analyzeMask(hypergraph, mask);
    for (let vertex = 0; vertex < 10; vertex += 1) {
      if ((mask & (1n << BigInt(vertex))) !== 0n) {
        continue;
      }
      const after = analyzeMask(hypergraph, addVertex(mask, vertex));
      assert.equal(after.completedCount - analysis.completedCount, analysis.completionGradient[vertex]);
    }
  }
});

test("global completion pressure counts one-hole progressions", () => {
  const hypergraph = intervalProgressions(11, 3);
  for (let mask = 0n; mask < (1n << 11n); mask += 1n) {
    const analysis = analyzeMask(hypergraph, mask);
    assert.equal(analysis.globalCompletionPressure, analysis.oneHoleCount);
  }
});

test("certificate passes all exact gates and finds a legacy-pressure collision", () => {
  const result = runCertificate({ exhaustiveThrough: 14, identityThrough: 10 });
  assert.equal(result.summary.status, "supported");
  assert.equal(result.summary.checks_passed, result.summary.checks_total);
  assert.ok(result.summary.first_same_size_legacy_collision);
});

test("invalid domain parameters are rejected", () => {
  assert.throws(() => intervalProgressions(0, 3), TypeError);
  assert.throws(() => intervalProgressions(5, 2), RangeError);
  assert.throws(() => finiteFieldThreeProgressions(2, 3), RangeError);
  assert.throws(() => finiteFieldThreeProgressions(9, 2), RangeError);
});
