# GEO-F2R3 Repeated Temporal Uncertainty Traces

Status: **supported**

Each trace contains independent noisy partial-arc fits, unequal time gaps, within-region drift, one occlusion crossing, and one recovery crossing. Bootstrap widths are normalized by the fitted geometry, not the generator parameters.

## Locked result

```text
trace_count=16
frames_per_trace=22
overall_fit_valid_fraction=0.9176136363636364
supported_acceptance_fraction=0.9545454545454546
boundary_acceptance_fraction=0.5056818181818182
boundary_to_supported_uncertainty_ratio=7.409481003953241
checks=12/12
```

## Evidence boundary

This is a deterministic synthetic repeated-measurement contract. It exports a harder temporal fixture for downstream PAM evaluation; it does not establish camera performance, physical ellipse dynamics, or a temporal memory benefit by itself.
