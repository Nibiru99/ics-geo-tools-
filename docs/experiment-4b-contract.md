# ICS v3 Experiment 4/4B clean-room reconstruction contract

Status: frozen before the first accepted benchmark result

## Purpose

Test the narrow historical finding that a coherence/efficiency-oriented branch score can rank valid no-op or reorder-only branches above a goal-completing branch, and that an explicit `goal_progress` term can repair that failure on controlled symbolic tasks.

## Reconstruction layers

### Layer A — archival metric replay

Inputs are the preserved branch rows from ICS v3 Experiments 4 and 4B. The replay must:

- recompute CEI and CEI-4B from their documented component fields;
- reproduce archived within-group ranks from the archived branch-health columns;
- reproduce the published aggregate top-1 rates and mean expected rank;
- label the historical generator as unavailable because the packaged Python entry points are placeholders.

Passing tolerance for numeric re-computation: absolute error at most `1e-9`, except for published decimal summaries rounded in the source package.

### Layer B — independent adversarial stress benchmark

The new benchmark has 100 deterministic seeds. Each seed creates six task archetypes. Every task has:

- one expected branch that completes the stated goal;
- a valid no-op or reorder-only distractor with attractive coherence/cost features;
- a second distractor that is either invalid or moves away from the goal.

The benchmark compares:

- `legacy`: a score without explicit goal progress;
- `goal_progress`: the same base score plus explicit goal progress and no-op/invalid penalties;
- `shuffled_goal`: the patched score after deterministically permuting goal-progress values within each task, as a negative control.

## Frozen primary outcomes

The reconstruction passes only if all conditions hold:

1. Archival Experiment 4 expected-branch top-1 equals `1/3` and valid-branch top-1 equals `1.0`.
2. Archival Experiment 4B expected-branch top-1 equals `1.0` and valid-branch top-1 equals `1.0`.
3. New benchmark `goal_progress` expected-branch top-1 is at least `0.90`.
4. New benchmark improvement over `legacy` is at least `0.25` absolute.
5. New benchmark `goal_progress` no-op-win rate is at most `0.05`.
6. `shuffled_goal` expected-branch top-1 is at least `0.20` below the unshuffled patched score.
7. Re-running with the same seed range produces byte-identical canonical JSON results.

## Interpretation boundary

A pass shows that explicit goal progress is necessary and effective in this controlled task family and that the archived metric tables are internally replayable. It does not show general planning competence, cognitive realism, large-scale architectural utility, or equivalence to the missing historical generator.
