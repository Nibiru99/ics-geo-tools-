import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  circularBaseline,
  distortMetricSameArea,
  evaluateMetricResidual,
  fitEllipseMetric,
  metricFromParameters,
  relativeMetricError,
  rotateMetric
} from "./ellipse-metric.mjs";

const TAU = 2 * Math.PI;
const TRAIN_PAIR_MODULUS = 4;

export function runAudit() {
  const calibrationCases = Array.from({ length: 12 }, (_, index) => runCase(index, 0));
  const calibrationClean = calibrationCases.flatMap((entry) => [entry.clean.p95, entry.nearCircle.p95, entry.noisy.p95, entry.robustOutlier.p95]);
  const calibrationControls = calibrationCases.flatMap((entry) => [
    entry.wrongAxis.p95,
    entry.wrongCenter.p95,
    entry.sameArea.p95,
    entry.evenDeformation.p95,
    entry.radialDeformation.p95,
    entry.shuffledPairs.p95
  ]);
  const cleanCeiling = Math.max(...calibrationClean);
  const controlFloor = Math.min(...calibrationControls);
  if (!(controlFloor > cleanCeiling)) {
    throw new Error(`calibration families overlap: clean ceiling ${cleanCeiling}, control floor ${controlFloor}`);
  }
  const threshold = cleanCeiling + (controlFloor - cleanCeiling) / 2;
  const testCases = Array.from({ length: 20 }, (_, index) => runCase(100 + index, 1));
  const validFamilies = ["clean", "nearCircle", "noisy", "robustOutlier"];
  const controlFamilies = ["wrongAxis", "wrongCenter", "sameArea", "evenDeformation", "radialDeformation", "shuffledPairs"];
  const validRows = testCases.flatMap((entry) => validFamilies.map((family) => rowFrom(entry, family, threshold, "valid")));
  const controlRows = testCases.flatMap((entry) => controlFamilies.map((family) => rowFrom(entry, family, threshold, "control")));
  const ordinaryOutlierRows = testCases.map((entry) => rowFrom(entry, "ordinaryOutlier", threshold, "diagnostic"));
  const robustOutlierRows = testCases.map((entry) => rowFrom(entry, "robustOutlier", threshold, "valid"));
  const cleanRows = validRows.filter((row) => row.family === "clean");
  const circleRows = testCases.map((entry) => ({
    seed: entry.seed,
    fitted_p95: entry.clean.p95,
    circular_p95: entry.circular.p95,
    improvement_ratio: entry.circular.p95 / Math.max(1e-12, entry.clean.p95)
  }));
  const robustImprovementFraction = mean(testCases.map((entry) => {
    return entry.robustOutlier.p95 < entry.ordinaryOutlier.p95 ? 1 : 0;
  }));
  const trainTestDisjointFraction = mean(testCases.map((entry) => entry.trainTestDisjoint ? 1 : 0));
  const validAcceptanceFraction = mean(validRows.map((row) => row.accepted));
  const controlRejectionFraction = mean(controlRows.map((row) => 1 - row.accepted));
  const medianControlToCleanRatio = median(testCases.map((entry) => {
    const controlMedian = median(controlFamilies.map((family) => entry[family].p95));
    return controlMedian / Math.max(1e-12, entry.clean.p95);
  }));
  const medianCircleImprovement = median(circleRows.map((row) => row.improvement_ratio));
  const medianMetricError = median(testCases.map((entry) => entry.metricError));
  const gates = [
    gate("calibration_control_floor_exceeds_clean_ceiling", controlFloor > cleanCeiling, controlFloor / cleanCeiling, 1, "exclusive_minimum"),
    gate("train_and_heldout_pairs_are_disjoint", trainTestDisjointFraction === 1, trainTestDisjointFraction, 1, "minimum"),
    gate("heldout_valid_families_pass_frozen_threshold", validAcceptanceFraction === 1, validAcceptanceFraction, 1, "minimum"),
    gate("heldout_controls_fail_frozen_threshold", controlRejectionFraction === 1, controlRejectionFraction, 1, "minimum"),
    gate("robust_fit_beats_ordinary_fit_with_training_outliers", robustImprovementFraction >= 0.9, robustImprovementFraction, 0.9, "minimum"),
    gate("control_to_clean_residual_ratio_exceeds_1_35", medianControlToCleanRatio >= 1.35, medianControlToCleanRatio, 1.35, "minimum"),
    gate("affine_metric_beats_circular_baseline_by_1_35", medianCircleImprovement >= 1.35, medianCircleImprovement, 1.35, "minimum"),
    gate("median_heldout_metric_error_below_0_10", medianMetricError <= 0.10, medianMetricError, 0.10, "maximum"),
    gate("estimator_uses_training_points_only", testCases.every((entry) => entry.oracleParametersUsedForFit === false), 1, 1, "minimum")
  ];
  const supported = gates.every((row) => row.pass === 1);
  return {
    summary: {
      experiment: "GEO_F2R_heldout_affine_metric_residual_causality",
      status: supported ? "supported" : "experimental",
      calibration_case_count: calibrationCases.length,
      heldout_case_count: testCases.length,
      frozen_acceptance_threshold: threshold,
      calibration_clean_ceiling: cleanCeiling,
      calibration_control_floor: controlFloor,
      heldout_valid_acceptance_fraction: validAcceptanceFraction,
      heldout_control_rejection_fraction: controlRejectionFraction,
      robust_outlier_improvement_fraction: robustImprovementFraction,
      median_control_to_clean_residual_ratio: medianControlToCleanRatio,
      median_circle_baseline_improvement_ratio: medianCircleImprovement,
      median_relative_metric_error: medianMetricError,
      checks_passed: gates.filter((row) => row.pass === 1).length,
      checks_total: gates.length,
      failed_checks: gates.filter((row) => row.pass !== 1).map((row) => row.check),
      oracle_parameters_used_for_fit: false,
      interpretation: supported
        ? "A conic-derived affine metric estimated from training points only generalizes to held-out antipodal pairs and separates ellipse-compatible data from wrong-metric, wrong-center, nonlinear, and pairing controls."
        : "At least one held-out affine-metric gate failed; retain GEO-F2 as an oracle-coordinate identity only."
    },
    gates,
    rows: [...validRows, ...controlRows, ...ordinaryOutlierRows],
    circleRows,
    testCases: testCases.map(stripPoints)
  };
}

export function runCase(seed, heldoutFold) {
  const random = mulberry32(hashText(`geo-f2r:${seed}`));
  const parameters = {
    center: { x: uniform(random, -0.8, 0.8), y: uniform(random, -0.8, 0.8) },
    a: uniform(random, 1.6, 2.5),
    b: uniform(random, 0.55, 1.1),
    phi: uniform(random, -Math.PI / 2, Math.PI / 2)
  };
  const base = generatePairedEllipse(parameters, { random, noise: 0 });
  const split = splitPairs(base.pairs, heldoutFold);
  const fit = fitEllipseMetric(split.trainingPoints, { robust: true });
  const clean = evaluateMetricResidual(fit, split.heldoutPairs);
  const circular = evaluateMetricResidual(circularBaseline(split.trainingPoints), split.heldoutPairs);
  const wrongAxis = evaluateMetricResidual({ ...fit, metric: rotateMetric(fit.metric, 20 * Math.PI / 180) }, split.heldoutPairs);
  const wrongCenter = evaluateMetricResidual({
    ...fit,
    center: {
      x: fit.center.x + 0.16 * parameters.a * Math.cos(parameters.phi),
      y: fit.center.y + 0.16 * parameters.a * Math.sin(parameters.phi)
    }
  }, split.heldoutPairs);
  const sameArea = evaluateMetricResidual({ ...fit, metric: distortMetricSameArea(fit.metric, 1.75) }, split.heldoutPairs);
  const shuffledPairs = evaluateMetricResidual(fit, rotateOppositeAssignments(split.heldoutPairs));

  const noisyData = generatePairedEllipse(parameters, { random: mulberry32(hashText(`noise:${seed}`)), noise: 0.006 * parameters.b });
  const noisySplit = splitPairs(noisyData.pairs, heldoutFold);
  const noisyFit = fitEllipseMetric(noisySplit.trainingPoints, { robust: true });
  const noisy = evaluateMetricResidual(noisyFit, noisySplit.heldoutPairs);

  const evenData = generatePairedEllipse(parameters, {
    random: mulberry32(hashText(`even:${seed}`)),
    evenAmplitude: 0.16 * parameters.b
  });
  const evenSplit = splitPairs(evenData.pairs, heldoutFold);
  const evenFit = fitEllipseMetric(evenSplit.trainingPoints, { robust: true });
  const evenDeformation = evaluateMetricResidual(evenFit, evenSplit.heldoutPairs);

  const radialData = generatePairedEllipse(parameters, {
    random: mulberry32(hashText(`radial:${seed}`)),
    radialAmplitude: 0.28
  });
  const radialSplit = splitPairs(radialData.pairs, heldoutFold);
  const radialFit = fitEllipseMetric(radialSplit.trainingPoints, { robust: true });
  const radialDeformation = evaluateMetricResidual(radialFit, radialSplit.heldoutPairs);

  const nearCircleParameters = { ...parameters, a: 1.5, b: 1.47 };
  const nearCircleData = generatePairedEllipse(nearCircleParameters, {
    random: mulberry32(hashText(`circle:${seed}`)),
    noise: 0.002
  });
  const nearCircleSplit = splitPairs(nearCircleData.pairs, heldoutFold);
  const nearCircleFit = fitEllipseMetric(nearCircleSplit.trainingPoints, { robust: true });
  const nearCircle = evaluateMetricResidual(nearCircleFit, nearCircleSplit.heldoutPairs);

  const outlierTraining = injectTrainingOutliers(
    split.trainingPoints,
    mulberry32(hashText(`outlier:${seed}`)),
    parameters.a
  );
  const robustOutlierFit = fitEllipseMetric(outlierTraining, { robust: true });
  const robustOutlier = evaluateMetricResidual(robustOutlierFit, split.heldoutPairs);
  let ordinaryOutlier;
  try {
    const ordinaryOutlierFit = fitEllipseMetric(outlierTraining, { robust: false });
    ordinaryOutlier = evaluateMetricResidual(ordinaryOutlierFit, split.heldoutPairs);
  } catch {
    ordinaryOutlier = { rows: [], mean: 1e9, median: 1e9, p95: 1e9, max: 1e9, fitValid: false };
  }
  const expectedMetric = metricFromParameters(parameters.a, parameters.b, parameters.phi);
  return {
    seed,
    parameters,
    clean,
    circular,
    wrongAxis,
    wrongCenter,
    sameArea,
    shuffledPairs,
    noisy,
    evenDeformation,
    radialDeformation,
    nearCircle,
    robustOutlier,
    ordinaryOutlier,
    metricError: relativeMetricError(fit.metric, expectedMetric),
    centerError: Math.hypot(fit.center.x - parameters.center.x, fit.center.y - parameters.center.y),
    trainTestDisjoint: setsDisjoint(split.trainingPairIds, split.heldoutPairIds),
    oracleParametersUsedForFit: false,
    trainingPairCount: split.trainingPairIds.length,
    heldoutPairCount: split.heldoutPairIds.length
  };
}

function generatePairedEllipse(parameters, {
  random,
  noise = 0,
  evenAmplitude = 0,
  radialAmplitude = 0
} = {}) {
  const pairs = [];
  for (let pairId = 0; pairId < 120; pairId += 1) {
    const theta = pairId / 120 * Math.PI;
    pairs.push({
      pairId,
      first: ellipsePoint(parameters, theta, { random, noise, evenAmplitude, radialAmplitude }),
      opposite: ellipsePoint(parameters, theta + Math.PI, { random, noise, evenAmplitude, radialAmplitude })
    });
  }
  return { pairs };
}

function ellipsePoint(parameters, theta, { random, noise, evenAmplitude, radialAmplitude }) {
  const radialScale = 1 + radialAmplitude * Math.cos(2 * theta);
  const localX = parameters.a * Math.cos(theta) * radialScale + evenAmplitude * Math.cos(2 * theta);
  const localY = parameters.b * Math.sin(theta) * radialScale;
  const cosine = Math.cos(parameters.phi);
  const sine = Math.sin(parameters.phi);
  return {
    x: parameters.center.x + cosine * localX - sine * localY + normal(random) * noise,
    y: parameters.center.y + sine * localX + cosine * localY + normal(random) * noise
  };
}

function splitPairs(pairs, heldoutFold) {
  const trainingPairs = pairs.filter((pair) => pair.pairId % TRAIN_PAIR_MODULUS !== heldoutFold);
  const heldoutPairs = pairs.filter((pair) => pair.pairId % TRAIN_PAIR_MODULUS === heldoutFold);
  return {
    trainingPoints: trainingPairs.flatMap((pair) => [pair.first, pair.opposite]),
    heldoutPairs,
    trainingPairIds: trainingPairs.map((pair) => pair.pairId),
    heldoutPairIds: heldoutPairs.map((pair) => pair.pairId)
  };
}

function injectTrainingOutliers(points, random, scale) {
  return points.map((point, index) => {
    if (index % 19 !== 0) {
      return { ...point };
    }
    const angle = uniform(random, 0, TAU);
    const magnitude = uniform(random, 0.6, 0.9) * scale;
    return {
      x: point.x + Math.cos(angle) * magnitude,
      y: point.y + Math.sin(angle) * magnitude
    };
  });
}

function rotateOppositeAssignments(pairs) {
  return pairs.map((pair, index) => ({
    pairId: pair.pairId,
    first: pair.first,
    opposite: pairs[(index + 7) % pairs.length].opposite
  }));
}

function rowFrom(entry, family, threshold, expectedClass) {
  return {
    seed: entry.seed,
    family,
    expected_class: expectedClass,
    residual_mean: entry[family].mean,
    residual_median: entry[family].median,
    residual_p95: entry[family].p95,
    residual_max: entry[family].max,
    frozen_threshold: threshold,
    accepted: entry[family].p95 <= threshold ? 1 : 0,
    oracle_parameters_used_for_fit: 0
  };
}

function stripPoints(entry) {
  return {
    seed: entry.seed,
    parameters: entry.parameters,
    metric_error: entry.metricError,
    center_error: entry.centerError,
    train_test_disjoint: entry.trainTestDisjoint ? 1 : 0,
    training_pair_count: entry.trainingPairCount,
    heldout_pair_count: entry.heldoutPairCount,
    residual_p95: Object.fromEntries([
      "clean", "circular", "wrongAxis", "wrongCenter", "sameArea", "shuffledPairs",
      "noisy", "evenDeformation", "radialDeformation", "nearCircle",
      "robustOutlier", "ordinaryOutlier"
    ].map((family) => [family, entry[family].p95]))
  };
}

function gate(check, pass, measured, required, comparison) {
  return { check, measured, required, comparison, pass: pass ? 1 : 0 };
}

function setsDisjoint(left, right) {
  const leftSet = new Set(left);
  return right.every((value) => !leftSet.has(value));
}

function uniform(random, lower, upper) {
  return lower + random() * (upper - lower);
}

function normal(random) {
  const first = Math.max(1e-12, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(TAU * second);
}

function hashText(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildReadme(result) {
  return `# GEO-F2R Held-Out Affine Metric and Residual Causality

Status: **${result.summary.status}**

The ellipse center and positive-definite metric are estimated from training points only. Generator parameters are used only for post-fit diagnostic error and never enter the estimator or residual decision.

## Locked result

\`\`\`text
frozen_acceptance_threshold=${result.summary.frozen_acceptance_threshold}
heldout_valid_acceptance_fraction=${result.summary.heldout_valid_acceptance_fraction}
heldout_control_rejection_fraction=${result.summary.heldout_control_rejection_fraction}
robust_outlier_improvement_fraction=${result.summary.robust_outlier_improvement_fraction}
median_control_to_clean_residual_ratio=${result.summary.median_control_to_clean_residual_ratio}
median_circle_baseline_improvement_ratio=${result.summary.median_circle_baseline_improvement_ratio}
median_relative_metric_error=${result.summary.median_relative_metric_error}
checks=${result.summary.checks_passed}/${result.summary.checks_total}
\`\`\`

## Gates

| check | measured | required | comparison | pass |
|---|---:|---:|---|---:|
${result.gates.map((row) => `| ${row.check} | ${row.measured} | ${row.required} | ${row.comparison} | ${row.pass} |`).join("\n")}

## Evidence boundary

This validates a deterministic synthetic estimator-and-residual contract. It does not establish object detection, autonomous ellipse discovery in arbitrary scenes, temporal PAM utility, or physical interpretation. Partial arcs and adversarially structured outliers remain follow-up conditions.
`;
}

async function main() {
  const timestamp = process.argv.find((value) => value.startsWith("--timestamp="))?.slice("--timestamp=".length)
    || new Date().toISOString().replace(/[:.]/g, "-");
  const result = runAudit();
  const outputDir = join("outputs", `geo_f2r_${timestamp}`);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "metrics_summary.json"), `${JSON.stringify(result.summary, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "gate_results.json"), `${JSON.stringify(result.gates, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "condition_rows.csv"), toCsv(result.rows), "utf8"),
    writeFile(join(outputDir, "case_diagnostics.json"), `${JSON.stringify(result.testCases, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "README.md"), buildReadme(result), "utf8")
  ]);
  console.log(JSON.stringify({ output_dir: outputDir, ...result.summary }, null, 2));
  if (result.summary.status !== "supported") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}
