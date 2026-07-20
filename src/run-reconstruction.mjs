import { mkdir, writeFile } from "node:fs/promises";
import { replayArchive } from "./archive-replay.mjs";
import { canonicalJson } from "./canonical-json.mjs";
import { evaluateContract } from "./contract.mjs";
import { runStressBenchmark } from "./stress-benchmark.mjs";

const archive = replayArchive();
const stress = runStressBenchmark();
const contract = evaluateContract(archive, stress);
const result = {
  schema_version: "1.0.0",
  reconstruction: "ICS v3 Experiments 4 and 4B",
  evidence_scope: "archival metric replay plus independent synthetic stress benchmark",
  archive,
  stress,
  contract
};

await mkdir("results", { recursive: true });
await writeFile("results/ics-v3-exp4-4b-reconstruction.json", canonicalJson(result));
process.stdout.write(canonicalJson(result));
if (!contract.pass) process.exitCode = 1;
