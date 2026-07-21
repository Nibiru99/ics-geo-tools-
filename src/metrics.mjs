export const EPSILON = 1e-12;

export function cei4(row) {
  const usefulDelta =
    0.38 * row.coherence_gain +
    0.26 * row.entropy_reduction +
    0.24 * row.uncertainty_reduction +
    0.12 * row.compression_gain;
  return usefulDelta / Math.max(row.transformation_cost, EPSILON);
}

export function cei4b(row) {
  const usefulDelta =
    0.30 * row.coherence_gain +
    0.20 * row.entropy_reduction +
    0.18 * row.uncertainty_reduction +
    0.12 * row.compression_gain +
    0.20 * row.goal_progress;
  return usefulDelta / Math.max(row.transformation_cost, EPSILON);
}

export function stableRank(rows, scoreKey) {
  return [...rows]
    .sort((a, b) => b[scoreKey] - a[scoreKey] || a.branch.localeCompare(b.branch))
    .map((row, index) => ({ ...row, replay_rank: index + 1 }));
}

export function legacyStressScore(row) {
  const usefulDelta =
    0.38 * row.coherence_gain +
    0.26 * row.entropy_reduction +
    0.24 * row.uncertainty_reduction +
    0.12 * row.compression_gain;
  const efficiency = usefulDelta / Math.max(row.transformation_cost, EPSILON);
  return (
    0.30 * Number(row.valid_transform) +
    0.22 * row.identity_preservation +
    0.20 * efficiency +
    0.16 * row.final_coherence +
    0.12 * row.load_efficiency
  );
}

export function goalProgressStressScore(row) {
  const usefulDelta =
    0.30 * row.coherence_gain +
    0.20 * row.entropy_reduction +
    0.18 * row.uncertainty_reduction +
    0.12 * row.compression_gain +
    0.20 * row.goal_progress;
  const efficiency = usefulDelta / Math.max(row.transformation_cost, EPSILON);
  return (
    0.22 * Number(row.valid_transform) +
    0.18 * row.goal_progress +
    0.16 * row.identity_preservation +
    0.16 * efficiency +
    0.12 * row.final_coherence +
    0.08 * row.load_efficiency +
    0.08 * row.state_progress -
    0.18 * row.noop_penalty -
    0.22 * row.invalid_penalty
  );
}
