import { goalProgressStressScore, legacyStressScore } from "./metrics.mjs";

const ARCHETYPES = ["pythagorean", "energy", "limit", "division", "equivalence", "retrieval"];

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function jitter(random, scale = 0.02) {
  return (random() - 0.5) * scale;
}

function makeTask(seed, archetype, archetypeIndex) {
  const random = mulberry32(seed * 101 + archetypeIndex * 1009 + 17);
  const expected = {
    branch: "solve_goal",
    expected_best: true,
    valid_transform: true,
    coherence_gain: 0.17 + jitter(random),
    entropy_reduction: 0.15 + jitter(random),
    uncertainty_reduction: 0.18 + jitter(random),
    compression_gain: 0.06 + jitter(random),
    identity_preservation: 0.96 + jitter(random, 0.01),
    transformation_cost: 0.58 + jitter(random, 0.04),
    final_coherence: 0.84 + jitter(random),
    load_efficiency: 0.62 + jitter(random),
    state_progress: 0.94 + jitter(random, 0.02),
    goal_progress: 1.0,
    noop_penalty: 0,
    invalid_penalty: 0
  };
  const noop = {
    branch: archetype === "pythagorean" ? "reorder_only" : "valid_noop",
    expected_best: false,
    valid_transform: true,
    coherence_gain: 0.08 + jitter(random),
    entropy_reduction: 0.11 + jitter(random),
    uncertainty_reduction: 0.09 + jitter(random),
    compression_gain: 0.12 + jitter(random),
    identity_preservation: 0.99 + jitter(random, 0.005),
    transformation_cost: 0.15 + jitter(random, 0.02),
    final_coherence: 0.88 + jitter(random),
    load_efficiency: 0.91 + jitter(random),
    state_progress: 0.04 + jitter(random, 0.02),
    goal_progress: 0.04 + jitter(random, 0.02),
    noop_penalty: 1,
    invalid_penalty: 0
  };
  const shortcut = {
    branch: "invalid_shortcut",
    expected_best: false,
    valid_transform: false,
    coherence_gain: 0.21 + jitter(random),
    entropy_reduction: 0.18 + jitter(random),
    uncertainty_reduction: 0.20 + jitter(random),
    compression_gain: 0.16 + jitter(random),
    identity_preservation: 0.48 + jitter(random, 0.04),
    transformation_cost: 0.12 + jitter(random, 0.02),
    final_coherence: 0.93 + jitter(random),
    load_efficiency: 0.94 + jitter(random),
    state_progress: -0.08 + jitter(random, 0.02),
    goal_progress: -0.10 + jitter(random, 0.02),
    noop_penalty: 0,
    invalid_penalty: 1
  };
  return { task_id: `${seed}-${archetype}`, rows: [expected, noop, shortcut] };
}

function rotateGoalValues(rows, offset) {
  const values = rows.map(row => row.goal_progress);
  return rows.map((row, index) => ({ ...row, goal_progress: values[(index + offset) % rows.length] }));
}

function evaluate(tasks, mode) {
  let expectedWins = 0;
  let validWins = 0;
  let noopWins = 0;
  let invalidWins = 0;
  let expectedRankSum = 0;
  let expectedMarginSum = 0;

  for (const [taskIndex, task] of tasks.entries()) {
    let rows = task.rows;
    if (mode === "shuffled_goal") rows = rotateGoalValues(rows, 1 + taskIndex % 2);
    const score = mode === "legacy" ? legacyStressScore : goalProgressStressScore;
    const ranked = rows
      .map(row => ({ ...row, score: score(row) }))
      .sort((a, b) => b.score - a.score || a.branch.localeCompare(b.branch));
    const top = ranked[0];
    const expectedRank = ranked.findIndex(row => row.expected_best) + 1;
    const expectedScore = ranked.find(row => row.expected_best).score;
    const bestDistractor = Math.max(...ranked.filter(row => !row.expected_best).map(row => row.score));
    expectedWins += Number(top.expected_best);
    validWins += Number(top.valid_transform);
    noopWins += Number(top.branch === "valid_noop" || top.branch === "reorder_only");
    invalidWins += Number(!top.valid_transform);
    expectedRankSum += expectedRank;
    expectedMarginSum += expectedScore - bestDistractor;
  }

  return {
    mode,
    task_count: tasks.length,
    expected_branch_top1_rate: expectedWins / tasks.length,
    valid_branch_top1_rate: validWins / tasks.length,
    noop_win_rate: noopWins / tasks.length,
    invalid_win_rate: invalidWins / tasks.length,
    mean_expected_branch_rank: expectedRankSum / tasks.length,
    mean_expected_margin: expectedMarginSum / tasks.length
  };
}

function evaluateWith(tasks, mode, score, transformRows = rows => rows) {
  let expectedWins = 0;
  let validWins = 0;
  let noopWins = 0;
  let invalidWins = 0;
  let expectedRankSum = 0;
  let expectedMarginSum = 0;

  for (const [taskIndex, task] of tasks.entries()) {
    const rows = transformRows(task.rows, taskIndex);
    const ranked = rows
      .map(row => ({ ...row, score: score(row) }))
      .sort((a, b) => b.score - a.score || a.branch.localeCompare(b.branch));
    const top = ranked[0];
    const expectedRank = ranked.findIndex(row => row.expected_best) + 1;
    const expectedScore = ranked.find(row => row.expected_best).score;
    const bestDistractor = Math.max(...ranked.filter(row => !row.expected_best).map(row => row.score));
    expectedWins += Number(top.expected_best);
    validWins += Number(top.valid_transform);
    noopWins += Number(top.branch === "valid_noop" || top.branch === "reorder_only");
    invalidWins += Number(!top.valid_transform);
    expectedRankSum += expectedRank;
    expectedMarginSum += expectedScore - bestDistractor;
  }

  return {
    mode,
    task_count: tasks.length,
    expected_branch_top1_rate: expectedWins / tasks.length,
    valid_branch_top1_rate: validWins / tasks.length,
    noop_win_rate: noopWins / tasks.length,
    invalid_win_rate: invalidWins / tasks.length,
    mean_expected_branch_rank: expectedRankSum / tasks.length,
    mean_expected_margin: expectedMarginSum / tasks.length
  };
}

function buildTasks(seedStart, seedCount) {
  const tasks = [];
  for (let seed = seedStart; seed < seedStart + seedCount; seed += 1) {
    ARCHETYPES.forEach((archetype, index) => tasks.push(makeTask(seed, archetype, index)));
  }
  return tasks;
}

function fixedGoalNoise(taskIndex, branchIndex) {
  const random = mulberry32(700001 + taskIndex * 1013 + branchIndex * 7919);
  return -0.2 + 1.4 * random();
}

function withGoalReliability(rows, taskIndex, reliability) {
  return rows.map((row, branchIndex) => ({
    ...row,
    goal_progress:
      reliability * row.goal_progress +
      (1 - reliability) * fixedGoalNoise(taskIndex, branchIndex)
  }));
}

function efficiencyOnlyScore(row) {
  const usefulDelta =
    0.38 * row.coherence_gain +
    0.26 * row.entropy_reduction +
    0.24 * row.uncertainty_reduction +
    0.12 * row.compression_gain;
  return usefulDelta / Math.max(row.transformation_cost, 1e-12);
}

function coherenceOnlyScore(row) {
  return row.final_coherence;
}

function validityCoherenceScore(row) {
  return 0.75 * Number(row.valid_transform) + 0.25 * row.final_coherence;
}

export function runStressBenchmark({ seedStart = 0, seedCount = 100 } = {}) {
  const tasks = buildTasks(seedStart, seedCount);
  const legacy = evaluate(tasks, "legacy");
  const goalProgress = evaluate(tasks, "goal_progress");
  const shuffledGoal = evaluate(tasks, "shuffled_goal");
  return {
    benchmark: "ICS-v3-4B-clean-room-stress",
    specification: "docs/experiment-4b-contract.md",
    seed_start: seedStart,
    seed_count: seedCount,
    task_archetypes: ARCHETYPES,
    legacy,
    goal_progress: goalProgress,
    shuffled_goal: shuffledGoal,
    improvement_absolute: goalProgress.expected_branch_top1_rate - legacy.expected_branch_top1_rate,
    shuffled_drop_absolute: goalProgress.expected_branch_top1_rate - shuffledGoal.expected_branch_top1_rate
  };
}

export function runGoalSignalSweep({
  seedStart = 0,
  seedCount = 100,
  reliabilities = [1, 0.8, 0.6, 0.4, 0.2, 0]
} = {}) {
  const tasks = buildTasks(seedStart, seedCount);
  const points = reliabilities.map(reliability => ({
    reliability,
    ...evaluateWith(
      tasks,
      `goal_reliability_${reliability.toFixed(1)}`,
      goalProgressStressScore,
      (rows, taskIndex) => withGoalReliability(rows, taskIndex, reliability)
    )
  }));
  const baselines = {
    legacy: evaluateWith(tasks, "legacy", legacyStressScore),
    efficiency_only: evaluateWith(tasks, "efficiency_only", efficiencyOnlyScore),
    coherence_only: evaluateWith(tasks, "coherence_only", coherenceOnlyScore),
    validity_plus_coherence: evaluateWith(tasks, "validity_plus_coherence", validityCoherenceScore)
  };
  const pointAt = reliability => points.find(point => point.reliability === reliability);
  const highReliabilityMean =
    (pointAt(1).expected_branch_top1_rate + pointAt(0.8).expected_branch_top1_rate) / 2;
  const bestBaseline = Math.max(...Object.values(baselines).map(x => x.expected_branch_top1_rate));
  return {
    benchmark: "ICS-v3-4B-goal-signal-reliability-sweep",
    specification: "docs/experiment-4b-contract.md",
    seed_start: seedStart,
    seed_count: seedCount,
    task_count: tasks.length,
    reliabilities,
    points,
    baselines,
    high_reliability_mean_top1: highReliabilityMean,
    full_to_zero_reliability_drop:
      pointAt(1).expected_branch_top1_rate - pointAt(0).expected_branch_top1_rate,
    best_baseline_top1: bestBaseline,
    full_reliability_advantage_over_best_baseline:
      pointAt(1).expected_branch_top1_rate - bestBaseline,
    first_below_0_90:
      points.find(point => point.expected_branch_top1_rate < 0.90)?.reliability ?? null
  };
}
