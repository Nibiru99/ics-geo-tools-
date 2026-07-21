export function evaluateContract(archive, stress, robustness) {
  const at = reliability => robustness.points.find(point => point.reliability === reliability);
  const primaryChecks = [
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
  const robustnessChecks = [
    ["robustness_full_signal", at(1).expected_branch_top1_rate >= 0.90],
    ["robustness_high_signal_mean", robustness.high_reliability_mean_top1 >= 0.85],
    ["robustness_zero_signal_bound", at(0).expected_branch_top1_rate <= 0.55],
    ["robustness_signal_drop", robustness.full_to_zero_reliability_drop >= 0.30],
    ["robustness_failure_region", robustness.first_below_0_90 !== null],
    ["robustness_baseline_advantage", robustness.full_reliability_advantage_over_best_baseline >= 0.25]
  ].map(([name, pass]) => ({ name, pass }));
  const primaryPass = primaryChecks.every(check => check.pass);
  const robustnessPass = robustnessChecks.every(check => check.pass);
  return {
    pass: primaryPass && robustnessPass,
    execution_integrity_pass:
      archive.exp4.max_cei_absolute_error <= 1e-9 &&
      archive.exp4b.max_cei_absolute_error <= 1e-9 &&
      archive.exp4.archived_rank_mismatches === 0 &&
      archive.exp4b.archived_rank_mismatches === 0,
    primary: { pass: primaryPass, checks: primaryChecks },
    robustness: { pass: robustnessPass, checks: robustnessChecks },
    failed_hypothesis_checks: [...primaryChecks, ...robustnessChecks].filter(check => !check.pass)
  };
}
