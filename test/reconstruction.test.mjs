import assert from "node:assert/strict";
import test from "node:test";
import { replayArchive } from "../src/archive-replay.mjs";
import { canonicalJson } from "../src/canonical-json.mjs";
import { evaluateContract } from "../src/contract.mjs";
import { runGoalSignalSweep, runStressBenchmark } from "../src/stress-benchmark.mjs";

test("archival CEI equations and archived ranks replay", () => {
  const archive = replayArchive();
  assert.ok(archive.exp4.max_cei_absolute_error <= 1e-9);
  assert.ok(archive.exp4b.max_cei_absolute_error <= 1e-9);
  assert.equal(archive.exp4.archived_rank_mismatches, 0);
  assert.equal(archive.exp4b.archived_rank_mismatches, 0);
  assert.ok(Math.abs(archive.exp4.expected_branch_top1_rate - 1 / 3) < 1e-12);
  assert.equal(archive.exp4b.expected_branch_top1_rate, 1);
});

test("frozen contracts report primary success and the unchanged robustness failure", () => {
  const archive = replayArchive();
  const stress = runStressBenchmark();
  const robustness = runGoalSignalSweep();
  const contract = evaluateContract(archive, stress, robustness);
  assert.equal(contract.primary.pass, true);
  assert.equal(contract.robustness.pass, false);
  assert.deepEqual(contract.failed_hypothesis_checks.map(check => check.name), ["robustness_zero_signal_bound"]);
  assert.equal(contract.execution_integrity_pass, true);
});

test("goal-signal reliability sweep records both robustness and failure regions", () => {
  const robustness = runGoalSignalSweep();
  assert.ok(robustness.points.find(point => point.reliability === 1).expected_branch_top1_rate >= 0.90);
  assert.equal(robustness.points.find(point => point.reliability === 0).expected_branch_top1_rate, 0.64);
  assert.notEqual(robustness.first_below_0_90, null);
});

test("same seed range produces byte-identical canonical JSON", () => {
  assert.equal(canonicalJson(runStressBenchmark()), canonicalJson(runStressBenchmark()));
  assert.equal(canonicalJson(runGoalSignalSweep()), canonicalJson(runGoalSignalSweep()));
});

test("changing seed range changes the benchmark result identity", () => {
  assert.notEqual(canonicalJson(runStressBenchmark({ seedStart: 0 })), canonicalJson(runStressBenchmark({ seedStart: 1 })));
});
