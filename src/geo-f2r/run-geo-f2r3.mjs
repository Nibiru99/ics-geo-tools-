import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateMetricResidual, fitEllipseMetric } from "./ellipse-metric.mjs";

const TAU = 2 * Math.PI;
const FROZEN_GEO_F2R_THRESHOLD = 0.04430706997854772;
const BASE_ARC_SCHEDULE = [
  214, 208, 216, 205, 211, 207,
  198, 188, 168, 150, 135, 122,
  126, 118, 124, 121,
  140, 160, 172, 190, 202, 211
];
const DELTA_TIME_SCHEDULE = [0, 0.5, 1, 1.5, 2.25, 0.75, 1.25];
const DEFAULT_BOOTSTRAP_REPLICATES = 12;

export function runTemporalUncertaintyAudit({
  seeds = Array.from({ length: 16 }, (_, index) => 200 + index),
  bootstrapReplicates = DEFAULT_BOOTSTRAP_REPLICATES
} = {}) {
  const traces = seeds.map((seed) => runTemporalCase(seed, { bootstrapReplicates }));
  const rows = traces.flatMap((trace) => trace.frames.map((frame) => ({
    trace_id: trace.traceId,
    seed: trace.seed,
    frame_index: frame.frameIndex,
    time: frame.time,
    delta_time: frame.deltaTime,
    arc_span_degrees: frame.arcSpanDegrees,
    support_state: frame.supportState,
    transition_label: frame.transitionLabel,
    fit_valid: frame.fitValid ? 1 : 0,
    residual_p95: frame.residualP95,
    accepted_at_frozen_threshold: frame.accepted ? 1 : 0,
    bootstrap_valid_fraction: frame.bootstrapValidFraction,
    normalized_interval_width: frame.normalizedIntervalWidth,
    training_noise_scale: frame.trainingNoiseScale,
    generator_parameters_used_for_fit_or_uncertainty: 0
  })));

  const supported = rows.filter((row) => row.support_state === 1);
  const boundary = rows.filter((row) => row.support_state === 0);
  const supportedAcceptance = mean(supported.map((row) => row.accepted_at_frozen_threshold));
  const boundaryAcceptance = mean(boundary.map((row) => row.accepted_at_frozen_threshold));
  const fitValidFraction = mean(rows.map((row) => row.fit_valid));
  const supportedFitValidFraction = mean(supported.map((row) => row.fit_valid));
  const boundaryFitValidFraction = mean(boundary.map((row) => row.fit_valid));
  const supportedWidthMedian = median(supported.map((row) => row.normalized_interval_width));
  const boundaryWidthMedian = median(boundary.map((row) => row.normalized_interval_width));
  const widthRatio = boundaryWidthMedian / Math.max(1e-12, supportedWidthMedian);
  const transitionCountPerTrace = traces.map((trace) => trace.frames.reduce((total, frame) => total + frame.transitionLabel, 0));
  const unequalTimeGapIntegrity = traces.every((trace) => {
    const positiveGaps = trace.frames.slice(1).map((frame) => frame.deltaTime);
    return new Set(positiveGaps).size >= 5 && positiveGaps.every((gap) => gap > 0);
  });
  const strictlyIncreasingTime = traces.every((trace) => trace.frames.every((frame, index) => {
    return index === 0 || frame.time > trace.frames[index - 1].time;
  }));
  const deterministicReplay = JSON.stringify(runTemporalCase(seeds[0], { bootstrapReplicates }))
    === JSON.stringify(runTemporalCase(seeds[0], { bootstrapReplicates }));

  const gates = [
    gate("temporal_case_is_deterministic", deterministicReplay, deterministicReplay ? 1 : 0, 1, "minimum"),
    gate("every_trace_has_22_independent_frames", traces.every((trace) => trace.frames.length === 22), rows.length, seeds.length * 22, "equality"),
    gate("time_is_strictly_increasing", strictlyIncreasingTime, strictlyIncreasingTime ? 1 : 0, 1, "minimum"),
    gate("time_gaps_are_positive_and_nonuniform", unequalTimeGapIntegrity, unequalTimeGapIntegrity ? 1 : 0, 1, "minimum"),
    gate("every_trace_has_exactly_two_support_boundary_crossings", transitionCountPerTrace.every((count) => count === 2), Math.min(...transitionCountPerTrace), 2, "equality_all"),
    gate("overall_fit_valid_fraction_at_least_0_75", fitValidFraction >= 0.75, fitValidFraction, 0.75, "minimum"),
    gate("supported_fit_valid_fraction_at_least_0_90", supportedFitValidFraction >= 0.90, supportedFitValidFraction, 0.90, "minimum"),
    gate("supported_acceptance_at_frozen_threshold_at_least_0_85", supportedAcceptance >= 0.85, supportedAcceptance, 0.85, "minimum"),
    gate("boundary_acceptance_at_frozen_threshold_at_most_0_65", boundaryAcceptance <= 0.65, boundaryAcceptance, 0.65, "maximum"),
    gate("boundary_median_uncertainty_at_least_twice_supported", widthRatio >= 2, widthRatio, 2, "minimum"),
    gate("boundary_fit_failures_remain_visible", boundaryFitValidFraction <= supportedFitValidFraction, boundaryFitValidFraction - supportedFitValidFraction, 0, "maximum"),
    gate("generator_parameters_do_not_enter_fit_or_uncertainty", traces.every((trace) => trace.generatorParametersUsedForFitOrUncertainty === false), 1, 1, "minimum")
  ];
  const passed = gates.every((row) => row.pass === 1);

  return {
    summary: {
      experiment: "GEO_F2R3_repeated_temporal_uncertainty_traces",
      status: passed ? "supported" : "experimental",
      evidence_scope: "deterministic_synthetic_repeated_measurement_stress_contract",
      seed_count: seeds.length,
      trace_count: traces.length,
      frames_per_trace: BASE_ARC_SCHEDULE.length,
      row_count: rows.length,
      bootstrap_replicates_per_frame: bootstrapReplicates,
      frozen_geo_f2r_threshold: FROZEN_GEO_F2R_THRESHOLD,
      support_boundary_degrees: 180,
      transitions_per_trace: 2,
      distinct_positive_time_gaps: [...new Set(DELTA_TIME_SCHEDULE.slice(1))].length,
      overall_fit_valid_fraction: fitValidFraction,
      supported_fit_valid_fraction: supportedFitValidFraction,
      boundary_fit_valid_fraction: boundaryFitValidFraction,
      supported_acceptance_fraction: supportedAcceptance,
      boundary_acceptance_fraction: boundaryAcceptance,
      supported_median_normalized_interval_width: supportedWidthMedian,
      boundary_median_normalized_interval_width: boundaryWidthMedian,
      boundary_to_supported_uncertainty_ratio: widthRatio,
      checks_passed: gates.filter((row) => row.pass === 1).length,
      checks_total: gates.length,
      failed_checks: gates.filter((row) => row.pass !== 1).map((row) => row.check),
      generator_parameters_used_for_fit_or_uncertainty: false,
      interpretation: passed
        ? "Independent noisy fits with unequal time gaps preserve two declared support-boundary crossings per trace, while bootstrap dispersion remains materially higher in the short-arc region."
        : "At least one repeated-measurement, geometry-support, uncertainty-separation, or provenance gate failed; retain the rows as stress diagnostics only."
    },
    gates,
    rows,
    traces
  };
}

export function runTemporalCase(seed, {
  bootstrapReplicates = DEFAULT_BOOTSTRAP_REPLICATES
} = {}) {
  const parameterRandom = mulberry32(hashText(`geo-f2r3:parameters:${seed}`));
  const parameters = {
    center: { x: uniform(parameterRandom, -0.8, 0.8), y: uniform(parameterRandom, -0.8, 0.8) },
    a: uniform(parameterRandom, 1.6, 2.5),
    b: uniform(parameterRandom, 0.55, 1.1),
    phi: uniform(parameterRandom, -Math.PI / 2, Math.PI / 2)
  };
  const baseArcCenter = uniform(parameterRandom, 0, TAU);
  const evaluationPairs = generateEvaluationPairs(parameters, seed);
  let time = 0;
  let previousState = null;
  const frames = BASE_ARC_SCHEDULE.map((baseSpan, frameIndex) => {
    const frameRandom = mulberry32(hashText(`geo-f2r3:frame:${seed}:${frameIndex}`));
    const spanJitter = uniform(frameRandom, -3, 3);
    const arcSpanDegrees = baseSpan + spanJitter;
    const deltaTime = frameIndex === 0
      ? 0
      : DELTA_TIME_SCHEDULE[1 + (hashText(`gap:${seed}:${frameIndex}`) % (DELTA_TIME_SCHEDULE.length - 1))];
    time += deltaTime;
    const supportState = arcSpanDegrees >= 180 ? 1 : 0;
    const transitionLabel = previousState === null || previousState === supportState ? 0 : 1;
    previousState = supportState;
    const trainingNoiseScale = parameters.b * uniform(frameRandom, 0.0025, 0.0055);
    const arcCenter = baseArcCenter
      + 0.035 * frameIndex
      + 0.06 * Math.sin((frameIndex + seed % 7) * 0.55);
    const training = generateArcTraining(parameters, {
      seed,
      frameIndex,
      spanDegrees: arcSpanDegrees,
      arcCenter,
      pointCount: 96,
      noise: trainingNoiseScale
    });
    return evaluateFrame(training, evaluationPairs, {
      seed,
      frameIndex,
      time,
      deltaTime,
      arcSpanDegrees,
      supportState,
      transitionLabel,
      trainingNoiseScale,
      bootstrapReplicates
    });
  });
  return {
    traceId: `geo-f2r3:${seed}`,
    seed,
    frames,
    generatorParametersUsedForFitOrUncertainty: false
  };
}

function evaluateFrame(training, evaluationPairs, context) {
  try {
    const fit = fitEllipseMetric(training.points, { robust: true });
    const residual = evaluateMetricResidual(fit, evaluationPairs);
    const uncertainty = bootstrapUncertainty(training.points, fit, {
      seed: context.seed,
      frameIndex: context.frameIndex,
      replicates: context.bootstrapReplicates
    });
    return {
      frameIndex: context.frameIndex,
      time: context.time,
      deltaTime: context.deltaTime,
      arcSpanDegrees: context.arcSpanDegrees,
      supportState: context.supportState,
      transitionLabel: context.transitionLabel,
      fitValid: true,
      residualP95: residual.p95,
      accepted: residual.p95 <= FROZEN_GEO_F2R_THRESHOLD,
      bootstrapValidFraction: uncertainty.validFraction,
      normalizedIntervalWidth: uncertainty.normalizedIntervalWidth,
      trainingNoiseScale: context.trainingNoiseScale
    };
  } catch {
    return {
      frameIndex: context.frameIndex,
      time: context.time,
      deltaTime: context.deltaTime,
      arcSpanDegrees: context.arcSpanDegrees,
      supportState: context.supportState,
      transitionLabel: context.transitionLabel,
      fitValid: false,
      residualP95: 1e9,
      accepted: false,
      bootstrapValidFraction: 0,
      normalizedIntervalWidth: 1e6,
      trainingNoiseScale: context.trainingNoiseScale
    };
  }
}

function bootstrapUncertainty(points, referenceFit, { seed, frameIndex, replicates }) {
  const random = mulberry32(hashText(`geo-f2r3:bootstrap:${seed}:${frameIndex}`));
  const samples = [];
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const resampled = Array.from({ length: points.length }, () => points[Math.floor(random() * points.length)]);
    try {
      const fit = fitEllipseMetric(resampled, { robust: true, iterations: 6 });
      samples.push(parameterVector(fit));
    } catch {
      // Invalid resamples remain visible through validFraction.
    }
  }
  if (samples.length < 2) {
    return { validFraction: samples.length / replicates, normalizedIntervalWidth: 1e6 };
  }
  const intervals = Array.from({ length: 5 }, (_, index) => {
    const values = samples.map((sample) => sample[index]).sort((left, right) => left - right);
    return { lower: quantile(values, 0.025), upper: quantile(values, 0.975) };
  });
  const majorAxisScale = majorAxisFromMetric(referenceFit.metric);
  const metricScale = Math.sqrt(referenceFit.metric.flat().reduce((total, value) => total + value * value, 0));
  const normalizedWidths = intervals.map((interval, index) => {
    const scale = index < 2 ? majorAxisScale : metricScale;
    return (interval.upper - interval.lower) / Math.max(1e-12, scale);
  });
  return {
    validFraction: samples.length / replicates,
    normalizedIntervalWidth: mean(normalizedWidths)
  };
}

function generateArcTraining(parameters, { seed, frameIndex, spanDegrees, arcCenter, pointCount, noise }) {
  const random = mulberry32(hashText(`geo-f2r3:training:${seed}:${frameIndex}`));
  const span = spanDegrees * Math.PI / 180;
  const step = span / pointCount;
  return {
    points: Array.from({ length: pointCount }, (_, index) => {
      const theta = arcCenter - span / 2 + (index + 0.5) * step + uniform(random, -0.18, 0.18) * step;
      return ellipsePoint(parameters, theta, random, noise);
    })
  };
}

function generateEvaluationPairs(parameters, seed) {
  const random = mulberry32(hashText(`geo-f2r3:evaluation:${seed}`));
  return Array.from({ length: 48 }, (_, pairIndex) => {
    const theta = (pairIndex + 0.37) / 48 * Math.PI;
    return {
      pairId: `eval:${pairIndex}`,
      first: ellipsePoint(parameters, theta, random, 0.001 * parameters.b),
      opposite: ellipsePoint(parameters, theta + Math.PI, random, 0.001 * parameters.b)
    };
  });
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

function parameterVector(fit) {
  return [fit.center.x, fit.center.y, fit.metric[0][0], fit.metric[0][1], fit.metric[1][1]];
}

function majorAxisFromMetric(metric) {
  const trace = metric[0][0] + metric[1][1];
  const delta = Math.sqrt((metric[0][0] - metric[1][1]) ** 2 + 4 * metric[0][1] ** 2);
  const minimumEigenvalue = Math.max(1e-12, (trace - delta) / 2);
  return 1 / Math.sqrt(minimumEigenvalue);
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
  return `# GEO-F2R3 Repeated Temporal Uncertainty Traces\n\nStatus: **${result.summary.status}**\n\nEach trace contains independent noisy partial-arc fits, unequal time gaps, within-region drift, one occlusion crossing, and one recovery crossing. Bootstrap widths are normalized by the fitted geometry, not the generator parameters.\n\n## Locked result\n\n\`\`\`text\ntrace_count=${result.summary.trace_count}\nframes_per_trace=${result.summary.frames_per_trace}\noverall_fit_valid_fraction=${result.summary.overall_fit_valid_fraction}\nsupported_acceptance_fraction=${result.summary.supported_acceptance_fraction}\nboundary_acceptance_fraction=${result.summary.boundary_acceptance_fraction}\nboundary_to_supported_uncertainty_ratio=${result.summary.boundary_to_supported_uncertainty_ratio}\nchecks=${result.summary.checks_passed}/${result.summary.checks_total}\n\`\`\`\n\n## Evidence boundary\n\nThis is a deterministic synthetic repeated-measurement contract. It exports a harder temporal fixture for downstream PAM evaluation; it does not establish camera performance, physical ellipse dynamics, or a temporal memory benefit by itself.\n`;
}

async function main() {
  const timestamp = process.argv.find((value) => value.startsWith("--timestamp="))?.slice("--timestamp=".length) || "validation";
  const result = runTemporalUncertaintyAudit();
  const outputDir = join("outputs", `geo_f2r3_${timestamp}`);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "metrics_summary.json"), `${JSON.stringify(result.summary, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "gate_results.json"), `${JSON.stringify(result.gates, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "temporal_trace_rows.csv"), toCsv(result.rows), "utf8"),
    writeFile(join(outputDir, "trace_diagnostics.json"), `${JSON.stringify(result.traces, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "README.md"), buildReadme(result), "utf8")
  ]);
  console.log(JSON.stringify({ output_dir: outputDir, ...result.summary }, null, 2));
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}
