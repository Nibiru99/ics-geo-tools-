import assert from "node:assert/strict";
import test from "node:test";
import { replayArchive } from "../src/archive-replay.mjs";
import { canonicalJson } from "../src/canonical-json.mjs";
import { evaluateContract } from "../src/contract.mjs";
import { runStressBenchmark } from "../src/stress-benchmark.mjs";

test("archival CEI equations and archived ranks replay", () => {
  const archive = replayArchive();
  assert.ok(archive.exp4.max_cei_absolute_error <= 1e-9);
  assert.ok(archive.exp4b.max_cei_absolute_error <= 1e-9);
  assert.equal(archive.exp4.archived_rank_mismatches, 0);
  assert.equal(archive.exp4b.archived_rank_mismatches, 0);
  assert.ok(Math.abs(archive.exp4.expected_branch_top1_rate - 1 / 3) < 1e-12);
  assert.equal(archive.exp4b.expected_branch_top1_rate, 1);
});

test("new adversarial benchmark satisfies the frozen contract", () => {
  const archive = replayArchive();
  const stress = runStressBenchmark();
  const contract = evaluateContract(archive, stress);
  assert.equal(contract.pass, true, contract.checks.filter(check => !check.pass).map(check => check.name).join(", "));
});

test("same seed range produces byte-identical canonical JSON", () => {
  assert.equal(canonicalJson(runStressBenchmark()), canonicalJson(runStressBenchmark()));
});

test("changing seed range changes the benchmark result identity", () => {
  assert.notEqual(canonicalJson(runStressBenchmark({ seedStart: 0 })), canonicalJson(runStressBenchmark({ seedStart: 1 })));
});
