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

## Frozen secondary robustness outcomes

After the primary contract was satisfied, a second contract was frozen before running a goal-signal reliability sweep. The task rows and scoring weights remain unchanged. Only the goal-progress observation is mixed with deterministic branch-level noise:

```text
observed_goal = reliability * true_goal + (1 - reliability) * fixed_noise
```

Reliability is swept over `1.0, 0.8, 0.6, 0.4, 0.2, 0.0`. The fixed-noise value is generated once per task/branch and reused across the sweep, so adjacent points differ only in signal mixture.

The sweep passes only if:

1. patched expected-branch top-1 is at least `0.90` at reliability `1.0`;
2. mean patched top-1 across reliability `1.0` and `0.8` is at least `0.85`;
3. patched top-1 at reliability `0.0` is at most `0.55`;
4. the drop from reliability `1.0` to `0.0` is at least `0.30`;
5. at least one tested reliability is below `0.90`, establishing a measured failure region;
6. at reliability `1.0`, the patched score exceeds the best of the legacy, efficiency-only, coherence-only, and validity-plus-coherence baselines by at least `0.25`.

This sweep is a sensitivity analysis, not evidence that the chosen noise model represents real planning systems.

## Secondary outcome

Result: **five of six conditions passed; the secondary robustness contract failed.**

At zero goal-signal reliability, expected-branch top-1 was `0.64`, exceeding the frozen maximum of `0.55`. The threshold is retained unchanged. This shows that identity, validity, state-progress, and penalty features in the task construction remain correlated with the expected branch and leak enough information to keep performance above the specified chance-region bound.

The first point below `0.90` occurred at reliability `0.20`, where expected top-1 was `0.8433`. At reliability `0.00`, no-op wins rose to `0.3067` and invalid wins to `0.0533`. The next experiment should orthogonalize these non-goal features rather than retune this benchmark after observing the result.

## Interpretation boundary

A pass shows that explicit goal progress is necessary and effective in this controlled task family and that the archived metric tables are internally replayable. It does not show general planning competence, cognitive realism, large-scale architectural utility, or equivalence to the missing historical generator.
