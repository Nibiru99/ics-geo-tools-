import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  addVertex,
  analyzeMask,
  cyclicThreeProgressions,
  exhaustiveIntervalSummary,
  finiteFieldThreeProgressions,
  intervalProgressions
} from "./progression-hypergraph.mjs";

export function runCertificate({ exhaustiveThrough = 16, identityThrough = 12 } = {}) {
  const exhaustive = [];
  for (let n = 3; n <= exhaustiveThrough; n += 1) {
    exhaustive.push(exhaustiveIntervalSummary(n, 3));
  }
  const identityChecks = [];
  for (let n = 3; n <= identityThrough; n += 1) {
    const hypergraph = intervalProgressions(n, 3);
    const subsetCount = 1n << BigInt(n);
    for (let mask = 0n; mask < subsetCount; mask += 1n) {
      const analysis = analyzeMask(hypergraph, mask);
      const legacyIdentity = analysis.legacyPressure === analysis.legacyOccupancy
        && analysis.legacyPressure === analysis.degreeWeightedOccupancy;
      const gammaIdentity = analysis.globalCompletionPressure === analysis.oneHoleCount;
      let gradientIdentity = true;
      let maximalityIdentity = analysis.maximalProgressionFree === bruteMaximality(hypergraph, mask, analysis);
      for (let vertex = 0; vertex < n; vertex += 1) {
        if ((mask & (1n << BigInt(vertex))) !== 0n) {
          continue;
        }
        const completedAfterAddition = analyzeMask(hypergraph, addVertex(mask, vertex)).completedCount;
        if (completedAfterAddition - analysis.completedCount !== analysis.completionGradient[vertex]) {
          gradientIdentity = false;
          break;
        }
      }
      identityChecks.push({ n, mask: mask.toString(), legacyIdentity, gammaIdentity, gradientIdentity, maximalityIdentity });
    }
  }
  const intervalFive = intervalProgressions(5, 3);
  const cyclicSeven = cyclicThreeProgressions(7);
  const fieldThreeSquared = finiteFieldThreeProgressions(3, 2);
  const collisionRow = exhaustive.find((row) => row.sameSizeLegacyDifferentCompletion);
  const collision = collisionRow ? {
    domain: collisionRow.domain,
    vertexCount: collisionRow.vertexCount,
    ...collisionRow.sameSizeLegacyDifferentCompletion
  } : null;
  const gates = [
    gate("interval_[5]_has_four_3AP_edges", intervalFive.indexedEdges.length === 4, intervalFive.indexedEdges.length, 4),
    gate("cyclic_Z7_has_twenty_one_unique_3AP_edges", cyclicSeven.indexedEdges.length === 21, cyclicSeven.indexedEdges.length, 21),
    gate("finite_field_F3^2_has_twelve_affine_lines", fieldThreeSquared.indexedEdges.length === 12, fieldThreeSquared.indexedEdges.length, 12),
    gate("AP48_pressure_equals_total_edge_occupancy", identityChecks.every((row) => row.legacyIdentity), failedCount(identityChecks, "legacyIdentity"), 0),
    gate("completion_gradient_is_discrete_derivative", identityChecks.every((row) => row.gradientIdentity), failedCount(identityChecks, "gradientIdentity"), 0),
    gate("global_completion_pressure_counts_one_hole_edges", identityChecks.every((row) => row.gammaIdentity), failedCount(identityChecks, "gammaIdentity"), 0),
    gate("maximal_AP_free_equivalence_holds", identityChecks.every((row) => row.maximalityIdentity), failedCount(identityChecks, "maximalityIdentity"), 0),
    gate("same_size_legacy_collision_has_different_nonlinear_state", collision !== null, collision ? 1 : 0, 1)
  ];
  const supported = gates.every((row) => row.pass === 1);
  return {
    summary: {
      experiment: "AP_CERT_0_exact_completion_gradient",
      status: supported ? "supported" : "experimental",
      exhaustive_interval_through: exhaustiveThrough,
      exhaustive_identity_through: identityThrough,
      checked_subset_count: identityChecks.length,
      checks_passed: gates.filter((row) => row.pass === 1).length,
      checks_total: gates.length,
      failed_checks: gates.filter((row) => row.pass !== 1).map((row) => row.check),
      domain_edge_counts: {
        interval_5: intervalFive.indexedEdges.length,
        cyclic_Z7: cyclicSeven.indexedEdges.length,
        finite_field_F3_squared: fieldThreeSquared.indexedEdges.length
      },
      first_same_size_legacy_collision: collision,
      interpretation: supported
        ? "The AP48 pressure is exhaustively confirmed to be linear edge occupancy, while the proposed completion gradient is the exact discrete derivative of completed-progression count and characterizes maximal AP-free sets under single additions."
        : "At least one exact identity or domain-separation gate failed."
    },
    gates,
    exhaustive
  };
}

function bruteMaximality(hypergraph, mask, analysis) {
  if (!analysis.progressionFree) {
    return false;
  }
  for (let vertex = 0; vertex < hypergraph.vertices.length; vertex += 1) {
    if ((mask & (1n << BigInt(vertex))) !== 0n) {
      continue;
    }
    if (analyzeMask(hypergraph, addVertex(mask, vertex)).progressionFree) {
      return false;
    }
  }
  return true;
}

function failedCount(rows, field) {
  return rows.filter((row) => !row[field]).length;
}

function gate(check, pass, measured, required) {
  return { check, measured, required, pass: pass ? 1 : 0 };
}

async function main() {
  const timestamp = process.argv.find((value) => value.startsWith("--timestamp="))?.slice("--timestamp=".length)
    || new Date().toISOString().replace(/[:.]/g, "-");
  const result = runCertificate();
  const outputDir = join("outputs", `ap_cert_0_${timestamp}`);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "metrics_summary.json"), `${JSON.stringify(result.summary, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "gate_results.json"), `${JSON.stringify(result.gates, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "exact_interval_summary.csv"), toCsv(result.exhaustive), "utf8"),
    writeFile(join(outputDir, "README.md"), buildReadme(result), "utf8")
  ]);
  console.log(JSON.stringify({ output_dir: outputDir, ...result.summary }, null, 2));
  if (result.summary.status !== "supported") {
    process.exitCode = 1;
  }
}

function buildReadme(result) {
  const { summary, gates } = result;
  return `# AP-CERT-0 Exact Completion-Gradient Certificate

Status: **${summary.status}**

## Certified identities

For a finite progression hypergraph with indicator variables \\(a_v\\):

\\[
H(A)=\\sum_P\\prod_{v\\in P}a_v,
\\qquad
G_A(x)=(1-a_x)\\sum_{P\\ni x}\\prod_{v\\in P\\setminus\\{x\\}}a_v.
\\]

The exhaustive checks confirm:

1. the AP48 total pressure equals \\(\\sum_P |A\\cap P|=\\sum_{a\\in A}\\deg(a)\\);
2. \\(G_A(x)=H(A\\cup\\{x\\})-H(A)\\) for \\(x\\notin A\\);
3. \\(\\sum_xG_A(x)\\) is the exact number of one-hole progressions;
4. an AP-free set is inclusion-maximal exactly when every outside vertex has positive completion gradient.

## Gates

| check | measured | required | pass |
|---|---:|---:|---:|
${gates.map((row) => `| ${row.check} | ${row.measured} | ${row.required} | ${row.pass} |`).join("\n")}

## Finite interval summary

| N | 3-AP edges | AP-free sets | maximal AP-free sets | max size | minimum maximal size |
|---:|---:|---:|---:|---:|---:|
${result.exhaustive.map((row) => `| ${row.vertexCount} | ${row.edgeCount} | ${row.progressionFreeCount} | ${row.maximalProgressionFreeCount} | ${row.maximumProgressionFreeSize} | ${row.minimumMaximalProgressionFreeSize} |`).join("\n")}

The interval, cyclic-group, and finite-field constructors are deliberately separate. Their edge counts and extremal questions must not be merged into one asymptotic claim.
`;
}

function toCsv(rows) {
  const flattened = rows.map((row) => ({
    domain: row.domain,
    vertex_count: row.vertexCount,
    edge_count: row.edgeCount,
    subset_count: row.subsetCount,
    progression_free_count: row.progressionFreeCount,
    maximal_progression_free_count: row.maximalProgressionFreeCount,
    maximum_progression_free_size: row.maximumProgressionFreeSize,
    maximum_witness: row.maximumWitness.join(" "),
    minimum_maximal_progression_free_size: row.minimumMaximalProgressionFreeSize,
    minimum_maximal_witness: row.minimumMaximalWitness?.join(" ") ?? ""
  }));
  const headers = Object.keys(flattened[0] ?? {});
  return `${headers.join(",")}\n${flattened.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}
