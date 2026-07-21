import { mkdir, writeFile } from "node:fs/promises";
import { replayArchive } from "./archive-replay.mjs";
import { canonicalJson } from "./canonical-json.mjs";
import { evaluateContract } from "./contract.mjs";
import { runGoalSignalSweep, runStressBenchmark } from "./stress-benchmark.mjs";

const archive = replayArchive();
const stress = runStressBenchmark();
const robustness = runGoalSignalSweep();
const contract = evaluateContract(archive, stress, robustness);
const result = {
  schema_version: "1.0.0",
  reconstruction: "ICS v3 Experiments 4 and 4B",
  evidence_scope: "archival metric replay plus independent synthetic stress benchmark",
  archive,
  stress,
  robustness,
  contract
};

await mkdir("results", { recursive: true });
await writeFile("results/ics-v3-exp4-4b-reconstruction.json", canonicalJson(result));
process.stdout.write(canonicalJson(result));
if (!contract.execution_integrity_pass) process.exitCode = 1;
