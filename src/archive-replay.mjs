import exp4Rows from "../fixtures/ics-v3-exp4-archived.json" with { type: "json" };
import exp4bRows from "../fixtures/ics-v3-exp4b-archived.json" with { type: "json" };
import { cei4, cei4b, stableRank } from "./metrics.mjs";

function groupBy(rows, key) {
  return Map.groupBy(rows, row => row[key]);
}

function replayOne(rows, config) {
  let maxCeiError = 0;
  let rankMismatches = 0;
  let expectedTop1 = 0;
  let validTop1 = 0;
  let expectedRankSum = 0;

  const groups = groupBy(rows, "group");
  for (const groupRows of groups.values()) {
    for (const row of groupRows) {
      maxCeiError = Math.max(maxCeiError, Math.abs(config.computeCei(row) - row[config.ceiKey]));
    }
    const ranked = stableRank(groupRows, config.healthKey);
    for (const row of ranked) {
      if (row.replay_rank !== row.branch_rank) rankMismatches += 1;
    }
    const top = ranked[0];
    expectedTop1 += Number(top.expected_best);
    validTop1 += Number(top.valid_transform);
    expectedRankSum += ranked.find(row => row.expected_best).replay_rank;
  }

  return {
    experiment: config.experiment,
    source: "preserved branch rows",
    historical_generator_status: "unavailable_placeholder_entry_point",
    group_count: groups.size,
    branch_count: rows.length,
    max_cei_absolute_error: maxCeiError,
    archived_rank_mismatches: rankMismatches,
    expected_branch_top1_rate: expectedTop1 / groups.size,
    valid_branch_top1_rate: validTop1 / groups.size,
    mean_expected_branch_rank: expectedRankSum / groups.size
  };
}

export function replayArchive() {
  return {
    exp4: replayOne(exp4Rows, {
      experiment: "ICS-v3-4",
      computeCei: cei4,
      ceiKey: "CEI",
      healthKey: "BranchHealth"
    }),
    exp4b: replayOne(exp4bRows, {
      experiment: "ICS-v3-4B",
      computeCei: cei4b,
      ceiKey: "CEI_4B",
      healthKey: "BranchHealth_4B"
    })
  };
}
