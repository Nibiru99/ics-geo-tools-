# GEO-F2R2: Partial-Arc and Structured-Contamination Contract

Status: **supported for the declared deterministic synthetic region**

## Question

GEO-F2R established that a center and positive-definite ellipse metric fitted from training points can score held-out antipodal pairs. GEO-F2R2 asks where that result stops working when the fit receives only a contiguous arc or a locally coherent cluster from a competing ellipse.

## Frozen protocol

- Reuse the GEO-F2R residual threshold `0.04430706997854772`; do not recalibrate it.
- Evaluate 16 new deterministic seeds.
- Fit noisy contiguous arcs spanning 270, 210, 180, 150, 120, and 90 degrees.
- Declare only spans of at least 180 degrees as the proposed support region.
- Replace contiguous training blocks with points from a translated, rotated competing ellipse at 5%, 10%, 15%, and 20% contamination.
- Declare only contamination through 10% as the proposed support region.
- Evaluate independent full-ellipse antipodal pairs.
- Construct 48-replicate percentile bootstrap intervals at 210 and 120 degrees.

Generator center, axes, and angle do not enter the estimator, residual decision, bootstrap resampling, or interval endpoints. They are used after fitting to score relative parameter error, normalize diagnostic interval widths, and measure empirical coverage.

## Locked result

| Quantity | Result |
|---|---:|
| Implementation tests | 8/8 |
| Stress gates | 10/10 |
| ≥180° acceptance at frozen threshold | 0.9375 |
| <180° acceptance at frozen threshold | 0.4375 |
| Median ≥180° relative metric error | 0.001556882511841694 |
| Robust acceptance at 5–10% clustered contamination | 1.0 |
| Robust acceptance at 15–20% clustered contamination | 0.59375 |
| 210° empirical marginal bootstrap coverage | 0.8875 |
| Median 120°/210° normalized interval-width ratio | 14.08558733756943 |

The pass is deliberately narrow. One of the 48 proposed ≥180° fits is invalid and two additional fits exceed the inherited threshold, so the result is a 90%-acceptance contract rather than a universal statement. Below 180°, acceptance drops sharply and bootstrap dispersion expands. Above 10% coherent contamination, robust acceptance also drops sharply.

## Mathematical object

For each bootstrap resample, the translated conic estimator returns

\[
\widehat c=-\frac12\widehat Q^{-1}\widehat\ell,
\qquad
\widehat M=\frac{\widehat Q}{1+\frac14\widehat\ell^\top\widehat Q^{-1}\widehat\ell}.
\]

The reported percentile interval for each component is the empirical 2.5%–97.5% interval across valid resamples. Coverage is measured only after those endpoints are frozen.

## Evidence boundary

This supports a deterministic synthetic regression contract, not arbitrary image-plane ellipse discovery. The bootstrap values are empirical finite-sample diagnostics, not distribution-free confidence intervals. The experiment does not establish segmentation, physical meaning, temporal PAM utility, or causal necessity. Short arcs and contamination above 10% remain negative stress boundaries for subsequent work.
