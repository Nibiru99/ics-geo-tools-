# GEO-F2R: Held-out affine metric and residual causality

Status: **supported for the declared deterministic synthetic contract**

## Question

Does GEO-F2's ellipse normalization survive when the center, axes, eccentricity, and orientation are estimated from training points instead of supplied from generator truth?

## Estimator

Training points are fitted to the translated conic

\[
x^\top Qx+\ell^\top x-1=0.
\]

For positive-definite \(Q\), the fitted center and normalized ellipse metric are

\[
c=-\frac12Q^{-1}\ell,
\qquad
M=\frac{Q}{1+\frac14\ell^\top Q^{-1}\ell}.
\]

Robust fitting uses deterministic subset consensus followed by Huber reweighting. Generator parameters are excluded from fitting and used only for post-fit diagnostic error.

For a held-out antipodal pair \(p(\theta),p(\theta+\pi)\),

\[
e_M(\theta)
=
\sqrt{
\left(p(\theta)+p(\theta+\pi)-2c\right)^\top
M
\left(p(\theta)+p(\theta+\pi)-2c\right)
},
\]

and radial residuals use

\[
d_M(p)=\left|\sqrt{(p-c)^\top M(p-c)}-1\right|.
\]

## Frozen protocol

- 12 calibration cases;
- 20 disjoint held-out cases;
- pair-level train/test separation;
- frozen acceptance threshold: \(0.04430706997854772\);
- clean, noisy, near-circle, and training-outlier valid families;
- wrong-axis, wrong-center, same-area, even-harmonic, radial-deformation, and shuffled-pair controls;
- circular metric baseline;
- no post-test threshold adjustment.

## Locked result

- implementation tests: 4/4;
- held-out gates: 9/9;
- valid-family acceptance fraction: \(1.0\);
- control rejection fraction: \(1.0\);
- robust-outlier improvement fraction: \(1.0\);
- median relative metric error: \(1.098160227769925\times10^{-9}\);
- oracle parameters used for fitting: false.

## Evidence boundary

This supports the estimator-and-residual contract on deterministic synthetic full-ellipse sampling. It does not establish autonomous ellipse discovery in arbitrary images, object segmentation, temporal PAM utility, or a physical interpretation.

The current robust control uses approximately five percent isolated training outliers. Partial arcs, clustered/adversarial outliers, uncertainty intervals, and downstream PAM necessity remain explicit follow-up experiments.
