import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  evaluateMetricResidual,
  fitEllipseMetric,
  metricFromParameters,
  relativeMetricError
} from "./ellipse-metric.mjs";

const TAU = 2 * Math.PI;
const FROZEN_GEO_F2R_THRESHOLD = 0.04430706997854772;
const ARC_SPANS = [270, 210, 180, 150, 120, 90];
const SUPPORTED_ARC_SPANS = new Set([270, 210, 180]);
const CLUSTER_RATES = [0.05, 0.10, 0.15, 0.20];
const BOOTSTRAP_SPANS = [210, 120];
const BOOTSTRAP_REPLICATES = 48;

export function runStressAudit({
  testSeeds = Array.from({ length: 16 }, (_, index) => 100 + index),
  bootstrapReplicates = BOOTSTRAP_REPLICATES
} = {}) {
  const cases = testSeeds.map((seed) => runStressCase(seed, { bootstrapReplicates }));
  const arcRows = cases.flatMap((entry) => entry.arcs.map((arc) => ({
    seed: entry.seed,
    family: "partial_arc",
    arc_span_degrees: arc.spanDegrees,
    expected_region: SUPPORTED_ARC_SPANS.has(arc.spanDegrees) ? "declared_support" : "stress_boundary",
    fit_valid: arc.fitValid ? 1 : 0,
    residual_p95: arc.residualP95,
    accepted_at_frozen_threshold: arc.accepted ? 1 : 0,
    relative_metric_error: arc.metricError,
    center_error_over_major_axis: arc.centerErrorNormalized,
    train_eval_identifiers_disjoint: arc.trainEvalDisjoint ? 1 : 0
  })));
  const clusterRows = cases.flatMap((entry) => entry.clusters.map((cluster) => ({
    seed: entry.seed,
    family: "clustered_competing_ellipse",
    contamination_rate: cluster.rate,
    expected_region: cluster.rate <= 0.10 ? "declared_support" : "stress_boundary",
    robust_fit_valid: cluster.robust.fitValid ? 1 : 0,
    ordinary_fit_valid: cluster.ordinary.fitValid ? 1 : 0,
    robust_residual_p95: cluster.robust.residualP95,
    ordinary_residual_p95: cluster.ordinary.residualP95,
    robust_accepted_at_frozen_threshold: cluster.robust.accepted ? 1 : 0,
    robust_beats_ordinary: cluster.robust.residualP95 < cluster.ordinary.residualP95 ? 1 : 0,
    train_eval_identifiers_disjoint: cluster.trainEvalDisjoint ? 1 : 0
  })));
  const bootstrapRows = cases.flatMap((entry) => entry.bootstraps.map((bootstrap) => ({
    seed: entry.seed,
    family: "pairs_bootstrap",
    arc_span_degrees: bootstrap.spanDegrees,
    requested_replicates: bootstrapReplicates,
    valid_replicates: bootstrap.validReplicates,
    valid_fraction: bootstrap.validFraction,
    marginal_parameter_coverage: bootstrap.coverageFraction,
    normalized_interval_width: bootstrap.normalizedIntervalWidth,
    oracle_parameters_used_for_interval_construction: 0
  })));

  const supportedArcRows = arcRows.filter((row) => row.expected_region === "declared_support");
  const shortArcRows = arcRows.filter((row) => row.expected_region === "stress_boundary");
  const lowClusterRows = clusterRows.filter((row) => row.expected_region === "declared_support");
  const highClusterRows = clusterRows.filter((row) => row.expected_region === "stress_boundary");
  const longBootstrapRows = bootstrapRows.filter((row) => row.arc_span_degrees === 210);
  const widthRatios = cases.map((entry) => {
    const long = entry.bootstraps.find((row) => row.spanDegrees === 210);
    const short = entry.bootstraps.find((row) => row.spanDegrees === 120);
    return short.normalizedIntervalWidth / Math.max(1e-12, long.normalizedIntervalWidth);
  });

  const supportedArcAcceptance = mean(supportedArcRows.map((row) => row.accepted_at_frozen_threshold));
  const supportedArcValidity = mean(supportedArcRows.map((row) => row.fit_valid));
  const supportedArcMedianMetricError = median(supportedArcRows.map((row) => row.relative_metric_error));
  const shortArcAcceptance = mean(shortArcRows.map((row) => row.accepted_at_frozen_threshold));
  const lowClusterAcceptance = mean(lowClusterRows.map((row) => row.robust_accepted_at_frozen_threshold));
  const lowClusterImprovement = mean(lowClusterRows.map((row) => row.robust_beats_ordinary));
  const highClusterAcceptance = mean(highClusterRows.map((row) => row.robust_accepted_at_frozen_threshold));
  const bootstrapValidFraction = mean(longBootstrapRows.map((row) => row.valid_fraction));
  const longArcMarginalCoverage = mean(longBootstrapRows.map((row) => row.marginal_parameter_coverage));
  const medianShortToLongWidthRatio = median(widthRatios);
  const trainEvalDisjointFraction = mean([
    ...arcRows.map((row) => row.train_eval_identifiers_disjoint),
    ...clusterRows.map((row) => row.train_eval_identifiers_disjoint)
  ]);

  const gates = [
    gate("train_and_evaluation_identifiers_are_disjoint", trainEvalDisjointFraction === 1, trainEvalDisjointFraction, 1, "minimum"),
    gate("declared_partial_arcs_produce_valid_ellipse_fits", supportedArcValidity >= 0.95, supportedArcValidity, 0.95, "minimum"),
    gate("arcs_at_least_180_degrees_pass_frozen_geo_f2r_threshold", supportedArcAcceptance >= 0.90, supportedArcAcceptance, 0.90, "minimum"),
    gate("supported_arc_median_relative_metric_error_below_0_15", supportedArcMedianMetricError <= 0.15, supportedArcMedianMetricError, 0.15, "maximum"),
    gate("robust_fit_accepts_clustered_contamination_through_10_percent", lowClusterAcceptance >= 0.85, lowClusterAcceptance, 0.85, "minimum"),
    gate("robust_fit_beats_ordinary_fit_through_10_percent", lowClusterImprovement >= 0.75, lowClusterImprovement, 0.75, "minimum"),
    gate("long_arc_bootstrap_valid_fraction_at_least_0_90", bootstrapValidFraction >= 0.90, bootstrapValidFraction, 0.90, "minimum"),
    gate("long_arc_empirical_marginal_coverage_at_least_0_75", longArcMarginalCoverage >= 0.75, longArcMarginalCoverage, 0.75, "minimum"),
    gate("short_arc_bootstrap_width_is_at_least_1_5_times_long_arc", medianShortToLongWidthRatio >= 1.5, medianShortToLongWidthRatio, 1.5, "minimum"),
    gate("estimator_and_intervals_do_not_use_generator_parameters", cases.every((entry) => entry.oracleParametersUsedForFit === false), 1, 1, "minimum")
  ];
  const supported = gates.every((row) => row.pass === 1);

  return {
    summary: {
      experiment: "GEO_F2R2_partial_arc_clustered_outlier_bootstrap",
      status: supported ? "supported" : "experimental",
      evidence_scope: "deterministic_synthetic_stress_contract",
      heldout_case_count: cases.length,
      frozen_geo_f2r_threshold: FROZEN_GEO_F2R_THRESHOLD,
      declared_supported_arc_spans_degrees: [...SUPPORTED_ARC_SPANS],
      stress_boundary_arc_spans_degrees: ARC_SPANS.filter((span) => !SUPPORTED_ARC_SPANS.has(span)),
      supported_arc_acceptance_fraction: supportedArcAcceptance,
      supported_arc_fit_valid_fraction: supportedArcValidity,
      supported_arc_median_relative_metric_error: supportedArcMedianMetricError,
      short_arc_acceptance_fraction: shortArcAcceptance,
      low_cluster_robust_acceptance_fraction: lowClusterAcceptance,
      low_cluster_robust_improvement_fraction: lowClusterImprovement,
      high_cluster_robust_acceptance_fraction: highClusterAcceptance,
      long_arc_bootstrap_valid_fraction: bootstrapValidFraction,
      long_arc_empirical_marginal_coverage: longArcMarginalCoverage,
      median_short_to_long_interval_width_ratio: medianShortToLongWidthRatio,
      bootstrap_replicates_per_case: bootstrapReplicates,
      checks_passed: gates.filter((row) => row.pass === 1).length,
      checks_total: gates.length,
      failed_checks: gates.filter((row) => row.pass !== 1).map((row) => row.check),
      oracle_parameters_used_for_fit_or_interval_construction: false,
      interpretation: supported
        ? "The frozen GEO-F2R residual rule extends to the declared noisy partial-arc and clustered-contamination region, while bootstrap dispersion exposes the shorter-arc loss of identifiability."
        : "At least one preregistered robustness or empirical uncertainty gate failed; retain the passing conditions as diagnostics rather than extending the GEO-F2R support claim."
    },
    gates,
    arcRows,
    clusterRows,
    bootstrapRows,
    cases: cases.map(stripCase)
  };
}

export function runStressCase(seed, { bootstrapReplicates = BOOTSTRAP_REPLICATES } = {}) {
  const random = mulberry32(hashText(`geo-f2r2:${seed}`));
  const parameters = {
    center: { x: uniform(random, -0.8, 0.8), y: uniform(random, -0.8, 0.8) },
    a: uniform(random, 1.6, 2.5),
    b: uniform(random, 0.55, 1.1),
    phi: uniform(random, -Math.PI / 2, Math.PI / 2)
  };
  const arcCenter = uniform(random, 0, TAU);
  const expectedMetric = metricFromParameters(parameters.a, parameters.b, parameters.phi);
  const evaluationPairs = generateEvaluationPairs(parameters, seed);

  const arcTraining = new Map();
  const arcs = ARC_SPANS.map((spanDegrees) => {
    const training = generateArcTraining(parameters, {
      seed,
      spanDegrees,
      arcCenter,
      pointCount: 96,
      noise: 0.003 * parameters.b
    });
    arcTraining.set(spanDegrees, training);
    const evaluated = safeFitAndEvaluate(training.points, evaluationPairs, parameters, expectedMetric, true);
    return {
      spanDegrees,
      ...evaluated,
      trainEvalDisjoint: setsDisjoint(training.identifiers, evaluationPairs.flatMap(pairIdentifiers))
    };
  });

  const cleanFullTraining = generateArcTraining(parameters, {
    seed,
    spanDegrees: 360,
    arcCenter,
    pointCount: 120,
    noise: 0.003 * parameters.b
  });
  const clusters = CLUSTER_RATES.map((rate) => {
    const contaminated = injectCompetingEllipseCluster(cleanFullTraining, parameters, {
      seed,
      rate,
      arcCenter
    });
    return {
      rate,
      robust: safeFitAndEvaluate(contaminated.points, evaluationPairs, parameters, expectedMetric, true),
      ordinary: safeFitAndEvaluate(contaminated.points, evaluationPairs, parameters, expectedMetric, false),
      trainEvalDisjoint: setsDisjoint(contaminated.identifiers, evaluationPairs.flatMap(pairIdentifiers))
    };
  });

  const bootstraps = BOOTSTRAP_SPANS.map((spanDegrees) => bootstrapParameters(
    arcTraining.get(spanDegrees).points,
    parameters,
    expectedMetric,
    {
      seed: hashText(`bootstrap:${seed}:${spanDegrees}`),
      replicates: bootstrapReplicates,
      spanDegrees
    }
  ));

  return {
    seed,
    parameters,
    arcs,
    clusters,
    bootstraps,
    oracleParametersUsedForFit: false
  };
}

function safeFitAndEvaluate(points, pairs, parameters, expectedMetric, robust) {
  try {
    const fit = fitEllipseMetric(points, { robust });
    const residual = evaluateMetricResidual(fit, pairs);
    return {
      fitValid: true,
      residualP95: residual.p95,
      accepted: residual.p95 <= FROZEN_GEO_F2R_THRESHOLD,
      metricError: relativeMetricError(fit.metric, expectedMetric),
      centerErrorNormalized: Math.hypot(
        fit.center.x - parameters.center.x,
        fit.center.y - parameters.center.y
      ) / parameters.a
    };
  } catch {
    return {
      fitValid: false,
      residualP95: 1e9,
      accepted: false,
      metricError: 1e9,
      centerErrorNormalized: 1e9
    };
  }
}

function bootstrapParameters(points, parameters, expectedMetric, { seed, replicates, spanDegrees }) {
  const random = mulberry32(seed);
  const samples = [];
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const resampled = Array.from({ length: points.length }, () => points[Math.floor(random() * points.length)]);
    try {
      const fit = fitEllipseMetric(resampled, { robust: true });
      samples.push(parameterVector(fit.center, fit.metric));
    } catch {
      // Invalid resamples remain visible through valid_fraction.
    }
  }
  const truth = parameterVector(parameters.center, expectedMetric);
  const intervals = truth.map((_, index) => {
    const values = samples.map((sample) => sample[index]).sort((left, right) => left - right);
    return { lower: quantile(values, 0.025), upper: quantile(values, 0.975) };
  });
  const coverage = intervals.map((interval, index) => {
    return truth[index] >= interval.lower && truth[index] <= interval.upper ? 1 : 0;
  });
  const metricScale = Math.sqrt(expectedMetric.flat().reduce((total, value) => total + value * value, 0));
  const normalizedWidths = intervals.map((interval, index) => {
    const scale = index < 2 ? parameters.a : metricScale;
    return (interval.upper - interval.lower) / Math.max(1e-12, scale);
  });
  return {
    spanDegrees,
    validReplicates: samples.length,
    validFraction: samples.length / replicates,
    coverageFraction: mean(coverage),
    normalizedIntervalWidth: mean(normalizedWidths),
    intervals
  };
}

function generateArcTraining(parameters, {
  seed,
  spanDegrees,
  arcCenter,
  pointCount,
  noise
}) {
  const random = mulberry32(hashText(`arc:${seed}:${spanDegrees}`));
  const span = spanDegrees * Math.PI / 180;
  const step = span / pointCount;
  const points = [];
  const identifiers = [];
  for (let index = 0; index < pointCount; index += 1) {
    const jitter = uniform(random, -0.18, 0.18) * step;
    const theta = arcCenter - span / 2 + (index + 0.5) * step + jitter;
    points.push(ellipsePoint(parameters, theta, random, noise));
    identifiers.push(`train:${spanDegrees}:${index}`);
  }
  return { points, identifiers };
}

function generateEvaluationPairs(parameters, seed) {
  const random = mulberry32(hashText(`evaluation:${seed}`));
  return Array.from({ length: 48 }, (_, pairId) => {
    const theta = (pairId + 0.37) / 48 * Math.PI;
    return {
      pairId: `eval:${pairId}`,
      first: ellipsePoint(parameters, theta, random, 0.001 * parameters.b),
      opposite: ellipsePoint(parameters, theta + Math.PI, random, 0.001 * parameters.b)
    };
  });
}

function injectCompetingEllipseCluster(training, parameters, { seed, rate, arcCenter }) {
  const random = mulberry32(hashText(`cluster:${seed}:${rate}`));
  const pointCount = training.points.length;
  const clusterCount = Math.max(1, Math.round(pointCount * rate));
  const start = Math.floor(random() * pointCount);
  const contaminated = new Set(Array.from({ length: clusterCount }, (_, offset) => (start + offset) % pointCount));
  const direction = { x: Math.cos(parameters.phi), y: Math.sin(parameters.phi) };
  const competitor = {
    center: {
      x: parameters.center.x + 0.28 * parameters.a * direction.x,
      y: parameters.center.y + 0.28 * parameters.a * direction.y
    },
    a: 0.82 * parameters.a,
    b: 1.22 * parameters.b,
    phi: parameters.phi + 0.24
  };
  return {
    identifiers: [...training.identifiers],
    points: training.points.map((point, index) => {
      if (!contaminated.has(index)) {
        return { ...point };
      }
      const theta = arcCenter - Math.PI + (index + 0.5) / pointCount * TAU;
      return ellipsePoint(competitor, theta, random, 0.002 * parameters.b);
    })
  };
}

function ellipsePoint(parameters, theta, random, noise) {
  const localX = parameters.a * Math.cos(theta);
  const localY = parameters.b * Math.sin(theta);
  const cosine = Math.cos(parameters.phi);
  const sine = Math.sin(parameters.phi);
  return {
    x: parameters.center.x + cosine * localX - sine * localY + normal(random) * noise,
    y: parameters.center.y + sine * localX + cosine * localY + normal(random) * noise
  };
}

function pairIdentifiers(pair) {
  return [`${pair.pairId}:first`, `${pair.pairId}:opposite`];
}

function parameterVector(center, metric) {
  return [center.x, center.y, metric[0][0], metric[0][1], metric[1][1]];
}

function setsDisjoint(left, right) {
  const leftSet = new Set(left);
  return right.every((value) => !leftSet.has(value));
}

function stripCase(entry) {
  return {
    seed: entry.seed,
    arcs: entry.arcs,
    clusters: entry.clusters,
    bootstraps: entry.bootstraps,
    oracle_parameters_used_for_fit: entry.oracleParametersUsedForFit ? 1 : 0
  };
}

function gate(check, pass, measured, required, comparison) {
  return { check, measured, required, comparison, pass: pass ? 1 : 0 };
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

function quantile(sorted, probability) {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function median(values) {
  return quantile([...values].sort((left, right) => left - right), 0.5);
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
  return `# GEO-F2R2 Partial-Arc and Structured-Contamination Stress Audit

Status: **${result.summary.status}**

This experiment inherits the GEO-F2R acceptance threshold without retuning it. Fits receive only noisy observed training points. Generator center, axes, and angle are used after fitting solely to score diagnostic error and empirical interval coverage.

## Locked result

\`\`\`text
frozen_geo_f2r_threshold=${result.summary.frozen_geo_f2r_threshold}
supported_arc_acceptance_fraction=${result.summary.supported_arc_acceptance_fraction}
supported_arc_median_relative_metric_error=${result.summary.supported_arc_median_relative_metric_error}
short_arc_acceptance_fraction=${result.summary.short_arc_acceptance_fraction}
low_cluster_robust_acceptance_fraction=${result.summary.low_cluster_robust_acceptance_fraction}
high_cluster_robust_acceptance_fraction=${result.summary.high_cluster_robust_acceptance_fraction}
long_arc_empirical_marginal_coverage=${result.summary.long_arc_empirical_marginal_coverage}
median_short_to_long_interval_width_ratio=${result.summary.median_short_to_long_interval_width_ratio}
checks=${result.summary.checks_passed}/${result.summary.checks_total}
\`\`\`

## Gates

| check | measured | required | comparison | pass |
|---|---:|---:|---|---:|
${result.gates.map((row) => `| ${row.check} | ${row.measured} | ${row.required} | ${row.comparison} | ${row.pass} |`).join("\n")}

## Evidence boundary

The declared support region is limited to deterministic synthetic ellipses with noisy contiguous arcs of at least 180 degrees and clustered competing-ellipse contamination through 10%. Shorter arcs and contamination above 10% are retained as stress boundaries, not silently removed.

Bootstrap intervals are ordinary finite-sample percentile diagnostics. Their empirical coverage is not a distribution-free confidence theorem. This audit does not establish arbitrary-image detection, segmentation, physical interpretation, or downstream PAM benefit.
`;
}

async function main() {
  const timestamp = process.argv.find((value) => value.startsWith("--timestamp="))?.slice("--timestamp=".length)
    || new Date().toISOString().replace(/[:.]/g, "-");
  const result = runStressAudit();
  const outputDir = join("outputs", `geo_f2r2_${timestamp}`);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "metrics_summary.json"), `${JSON.stringify(result.summary, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "gate_results.json"), `${JSON.stringify(result.gates, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "partial_arc_rows.csv"), toCsv(result.arcRows), "utf8"),
    writeFile(join(outputDir, "clustered_outlier_rows.csv"), toCsv(result.clusterRows), "utf8"),
    writeFile(join(outputDir, "bootstrap_rows.csv"), toCsv(result.bootstrapRows), "utf8"),
    writeFile(join(outputDir, "case_diagnostics.json"), `${JSON.stringify(result.cases, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "README.md"), buildReadme(result), "utf8")
  ]);
  console.log(JSON.stringify({ output_dir: outputDir, ...result.summary }, null, 2));
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}
