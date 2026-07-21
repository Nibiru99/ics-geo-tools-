# GEO-F2R3: Repeated Temporal Uncertainty Traces

Status: **supported for a deterministic synthetic repeated-measurement contract**

## Question

GEO-F2R2 provided one partial-arc fit per seed and arc span. PAM-ELLIPSE-H3 could therefore identify temporal change only with constructed stationary pairs. GEO-F2R3 asks whether the geometry layer can export a genuinely repeated temporal fixture containing:

- independent noisy fits at every frame;
- drift within the supported and stress regions;
- one occlusion and one recovery crossing;
- unequal time gaps;
- per-frame bootstrap uncertainty;
- explicit fit failures rather than deleted rows.

## Frozen protocol

- 16 new seeds (`200`–`215`);
- 22 frames per trace;
- 96 independently regenerated training points per frame;
- an arc-span schedule moving from approximately 210° to 120° and back;
- deterministic frame-specific arc-center drift and noise variation;
- fixed independent full-ellipse evaluation pairs per seed;
- 12 bootstrap resamples per frame;
- the inherited GEO-F2R residual threshold `0.04430706997854772`;
- support state defined only for evaluation as `arc span >= 180°`;
- six distinct positive time gaps.

Bootstrap coordinate widths are normalized by the major-axis scale inferred from the fitted metric. Metric-component widths are normalized by the fitted metric norm. Generator center, axes, and angle do not enter fitting, resampling, interval endpoints, or width normalization.

## Locked result

| Quantity | Result |
|---|---:|
| Focused implementation tests | 6/6 |
| Frozen gates | 12/12 |
| Trace count | 16 |
| Frames per trace | 22 |
| Temporal rows | 352 |
| Crossings per trace | 2 |
| Overall fit-valid fraction | 0.91761 |
| Supported-region fit-valid fraction | 0.97159 |
| Boundary-region fit-valid fraction | 0.86364 |
| Supported-region frozen-threshold acceptance | 0.95455 |
| Boundary-region frozen-threshold acceptance | 0.50568 |
| Median supported normalized interval width | 0.0052434 |
| Median boundary normalized interval width | 0.0388512 |
| Boundary/supported uncertainty ratio | 7.40948 |

## Interpretation

The GEO-F2R2 boundary survives independent temporal remeasurement. Fits remain strong in the declared support region, while the short-arc region retains materially lower residual acceptance, more visible fit failures, and much wider bootstrap dispersion.

This output is suitable for a downstream PAM change-point stress test because consecutive frames are no longer duplicated controls. The time gaps, noise levels, arc centers, fit outcomes, and bootstrap samples vary independently and deterministically.

## Evidence boundary

GEO-F2R3 is still synthetic. Its arc-span trajectory is scheduled, the underlying ellipse is fixed within a trace, and evaluation labels use the known simulated span. The bootstrap width is a finite-sample diagnostic rather than a calibrated posterior variance. This experiment establishes a reproducible temporal geometry fixture; it does not itself establish PAM benefit, camera performance, or physical ellipse dynamics.
