import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateMetricResidual,
  fitEllipseMetric,
  metricFromParameters,
  relativeMetricError
} from "../src/geo-f2r/ellipse-metric.mjs";
import { runAudit } from "../src/geo-f2r/run-geo-f2r.mjs";

test("exact ellipse fit recovers center and affine metric from training points", () => {
  const parameters = { center: { x: 0.4, y: -0.2 }, a: 2.1, b: 0.8, phi: 0.63 };
  const points = Array.from({ length: 80 }, (_, index) => {
    const theta = index / 80 * 2 * Math.PI;
    const localX = parameters.a * Math.cos(theta);
    const localY = parameters.b * Math.sin(theta);
    return {
      x: parameters.center.x + Math.cos(parameters.phi) * localX - Math.sin(parameters.phi) * localY,
      y: parameters.center.y + Math.sin(parameters.phi) * localX + Math.cos(parameters.phi) * localY
    };
  });
  const fit = fitEllipseMetric(points, { robust: true });
  assert.ok(Math.hypot(fit.center.x - parameters.center.x, fit.center.y - parameters.center.y) < 1e-7);
  assert.ok(relativeMetricError(fit.metric, metricFromParameters(parameters.a, parameters.b, parameters.phi)) < 1e-7);
});

test("exact held-out antipodal residual is near zero", () => {
  const parameters = { center: { x: -0.3, y: 0.6 }, a: 1.9, b: 0.7, phi: -0.4 };
  const point = (theta) => {
    const x = parameters.a * Math.cos(theta);
    const y = parameters.b * Math.sin(theta);
    return {
      x: parameters.center.x + Math.cos(parameters.phi) * x - Math.sin(parameters.phi) * y,
      y: parameters.center.y + Math.sin(parameters.phi) * x + Math.cos(parameters.phi) * y
    };
  };
  const training = Array.from({ length: 60 }, (_, index) => point(index / 60 * 2 * Math.PI));
  const pairs = Array.from({ length: 20 }, (_, index) => ({
    pairId: index,
    first: point((index + 0.5) / 20 * Math.PI),
    opposite: point((index + 0.5) / 20 * Math.PI + Math.PI)
  }));
  const residual = evaluateMetricResidual(fitEllipseMetric(training), pairs);
  assert.ok(residual.max < 1e-7);
});

test("GEO-F2R passes frozen calibration and held-out controls", () => {
  const result = runAudit();
  assert.equal(result.summary.status, "supported");
  assert.equal(result.summary.checks_passed, result.summary.checks_total);
  assert.equal(result.summary.heldout_valid_acceptance_fraction, 1);
  assert.equal(result.summary.heldout_control_rejection_fraction, 1);
  assert.equal(result.summary.oracle_parameters_used_for_fit, false);
});

test("invalid fits are rejected", () => {
  assert.throws(() => fitEllipseMetric([]), RangeError);
  assert.throws(() => fitEllipseMetric(Array.from({ length: 8 }, (_, index) => ({ x: index, y: 0 }))), Error);
});
