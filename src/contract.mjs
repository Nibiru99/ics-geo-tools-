export function evaluateContract(archive, stress) {
  const checks = [
    ["archival_exp4_expected_top1", Math.abs(archive.exp4.expected_branch_top1_rate - 1 / 3) < 1e-12],
    ["archival_exp4_valid_top1", archive.exp4.valid_branch_top1_rate === 1],
    ["archival_exp4b_expected_top1", archive.exp4b.expected_branch_top1_rate === 1],
    ["archival_exp4b_valid_top1", archive.exp4b.valid_branch_top1_rate === 1],
    ["archival_cei_replay", archive.exp4.max_cei_absolute_error <= 1e-9 && archive.exp4b.max_cei_absolute_error <= 1e-9],
    ["archival_rank_replay", archive.exp4.archived_rank_mismatches === 0 && archive.exp4b.archived_rank_mismatches === 0],
    ["stress_goal_top1", stress.goal_progress.expected_branch_top1_rate >= 0.90],
    ["stress_improvement", stress.improvement_absolute >= 0.25],
    ["stress_noop_rate", stress.goal_progress.noop_win_rate <= 0.05],
    ["stress_shuffled_control", stress.shuffled_drop_absolute >= 0.20]
  ].map(([name, pass]) => ({ name, pass }));
  return { pass: checks.every(check => check.pass), checks };
}
