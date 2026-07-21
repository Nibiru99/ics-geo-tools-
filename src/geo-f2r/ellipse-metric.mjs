const EPSILON = 1e-12;

export function fitEllipseMetric(points, {
  robust = true,
  iterations = 12,
  huberK = 1.5,
  ridge = 1e-10
} = {}) {
  if (!Array.isArray(points) || points.length < 6) {
    throw new RangeError("at least six training points are required");
  }
  const origin = {
    x: median(points.map((point) => point.x)),
    y: median(points.map((point) => point.y))
  };
  const rows = points.map((point) => {
    const x = point.x - origin.x;
    const y = point.y - origin.y;
    return [x * x, x * y, y * y, x, y];
  });
  let coefficients = robust
    ? consensusInitialCoefficients(rows, ridge)
    : weightedLeastSquares(rows, Array(points.length).fill(1), ridge);
  for (let iteration = 0; iteration < (robust ? iterations : 0); iteration += 1) {
    const residuals = rows.map((row) => dot(row, coefficients) - 1);
    const centerResidual = median(residuals);
    const absoluteDeviations = residuals.map((value) => Math.abs(value - centerResidual));
    const scale = Math.max(EPSILON, 1.4826 * median(absoluteDeviations));
    const weights = residuals.map((value) => {
      const standardized = Math.abs(value - centerResidual) / scale;
      return standardized <= huberK ? 1 : huberK / standardized;
    });
    coefficients = weightedLeastSquares(rows, weights, ridge);
  }
  const [a, b, c, d, e] = coefficients;
  const q = [[a, b / 2], [b / 2, c]];
  const determinant = det2(q);
  if (!(a > 0 && c > 0 && determinant > EPSILON)) {
    throw new Error("fitted conic is not an ellipse");
  }
  const inverseQ = inverse2(q);
  const linear = [d, e];
  const localCenterVector = scale2(multiply2Vector(inverseQ, linear), -0.5);
  const center = {
    x: origin.x + localCenterVector[0],
    y: origin.y + localCenterVector[1]
  };
  const normalization = 1 + 0.25 * dot(linear, multiply2Vector(inverseQ, linear));
  if (!(normalization > EPSILON)) {
    throw new Error("ellipse normalization is non-positive");
  }
  const metric = scaleMatrix2(q, 1 / normalization);
  const eigenvalues = symmetricEigenvalues2(metric);
  if (!(eigenvalues[0] > EPSILON && eigenvalues[1] > EPSILON)) {
    throw new Error("fitted metric is not positive definite");
  }
  return {
    center,
    metric,
    coefficients: { a, b, c, d, e, constant: -1 },
    robust,
    iterations: robust ? iterations : 1,
    trainingPointCount: points.length,
    conditionNumber: eigenvalues[1] / eigenvalues[0]
  };
}

function consensusInitialCoefficients(rows, ridge) {
  const candidates = [];
  try {
    candidates.push(weightedLeastSquares(rows, Array(rows.length).fill(1), ridge));
  } catch {
    // The robust candidate subsets below may still define a valid conic.
  }
  const sampleSize = Math.min(14, rows.length);
  for (let candidateIndex = 0; candidateIndex < Math.min(48, rows.length); candidateIndex += 1) {
    const indices = [];
    for (let sampleIndex = 0; sampleIndex < sampleSize; sampleIndex += 1) {
      const index = (candidateIndex * 13 + sampleIndex * 17) % rows.length;
      if (!indices.includes(index)) {
        indices.push(index);
      }
    }
    if (indices.length < 6) {
      continue;
    }
    const sampleRows = indices.map((index) => rows[index]);
    try {
      const candidate = weightedLeastSquares(sampleRows, Array(sampleRows.length).fill(1), ridge);
      if (coefficientsFormEllipse(candidate)) {
        candidates.push(candidate);
      }
    } catch {
      // Singular or non-elliptic subsets are expected in deterministic consensus.
    }
  }
  const valid = candidates.filter(coefficientsFormEllipse);
  if (valid.length === 0) {
    throw new Error("no robust ellipse candidate was found");
  }
  return valid.sort((left, right) => {
    return median(rows.map((row) => Math.abs(dot(row, left) - 1)))
      - median(rows.map((row) => Math.abs(dot(row, right) - 1)));
  })[0];
}

function coefficientsFormEllipse([a, b, c, d, e]) {
  const q = [[a, b / 2], [b / 2, c]];
  if (!(a > 0 && c > 0 && det2(q) > EPSILON)) {
    return false;
  }
  try {
    const inverseQ = inverse2(q);
    return 1 + 0.25 * dot([d, e], multiply2Vector(inverseQ, [d, e])) > EPSILON;
  } catch {
    return false;
  }
}

export function evaluateMetricResidual(fit, pairs) {
  const rows = pairs.map((pair) => {
    const first = subtractPoint(pair.first, fit.center);
    const opposite = subtractPoint(pair.opposite, fit.center);
    const echoVector = addVector(first, opposite);
    const echoResidual = Math.sqrt(Math.max(0, quadratic(fit.metric, echoVector)));
    const firstRadial = Math.abs(Math.sqrt(Math.max(0, quadratic(fit.metric, first))) - 1);
    const oppositeRadial = Math.abs(Math.sqrt(Math.max(0, quadratic(fit.metric, opposite))) - 1);
    return {
      pairId: pair.pairId,
      echoResidual,
      firstRadial,
      oppositeRadial,
      score: Math.sqrt(echoResidual ** 2 + (firstRadial ** 2 + oppositeRadial ** 2) / 2)
    };
  });
  const scores = rows.map((row) => row.score).sort((left, right) => left - right);
  return {
    rows,
    mean: mean(scores),
    median: quantile(scores, 0.5),
    p95: quantile(scores, 0.95),
    max: scores.at(-1) ?? 0
  };
}

export function circularBaseline(points) {
  const center = {
    x: mean(points.map((point) => point.x)),
    y: mean(points.map((point) => point.y))
  };
  const radiusSquared = mean(points.map((point) => {
    const vector = subtractPoint(point, center);
    return vector.x ** 2 + vector.y ** 2;
  }));
  return {
    center,
    metric: [[1 / radiusSquared, 0], [0, 1 / radiusSquared]],
    robust: false,
    trainingPointCount: points.length
  };
}

export function rotateMetric(metric, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rotation = [[cosine, -sine], [sine, cosine]];
  return multiplyMatrices2(multiplyMatrices2(rotation, metric), transpose2(rotation));
}

export function distortMetricSameArea(metric, factor) {
  if (!(factor > 0)) {
    throw new RangeError("factor must be positive");
  }
  const decomposition = symmetricEigenvectors2(metric);
  const diagonal = [[decomposition.values[0] * factor, 0], [0, decomposition.values[1] / factor]];
  return multiplyMatrices2(
    multiplyMatrices2(decomposition.vectors, diagonal),
    transpose2(decomposition.vectors)
  );
}

export function relativeMetricError(estimated, expected) {
  const difference = [
    [estimated[0][0] - expected[0][0], estimated[0][1] - expected[0][1]],
    [estimated[1][0] - expected[1][0], estimated[1][1] - expected[1][1]]
  ];
  return frobenius2(difference) / Math.max(EPSILON, frobenius2(expected));
}

export function metricFromParameters(a, b, phi) {
  const diagonal = [[1 / (a * a), 0], [0, 1 / (b * b)]];
  return rotateMetric(diagonal, phi);
}

function weightedLeastSquares(rows, weights, ridge) {
  const dimension = rows[0].length;
  const normal = Array.from({ length: dimension }, () => Array(dimension).fill(0));
  const right = Array(dimension).fill(0);
  rows.forEach((row, rowIndex) => {
    const weight = weights[rowIndex];
    for (let i = 0; i < dimension; i += 1) {
      right[i] += weight * row[i];
      for (let j = 0; j < dimension; j += 1) {
        normal[i][j] += weight * row[i] * row[j];
      }
    }
  });
  const trace = normal.reduce((total, row, index) => total + row[index], 0);
  const regularization = ridge * Math.max(1, trace / dimension);
  for (let index = 0; index < dimension; index += 1) {
    normal[index][index] += regularization;
  }
  return solveLinearSystem(normal, right);
}

function solveLinearSystem(matrix, right) {
  const augmented = matrix.map((row, index) => [...row, right[index]]);
  for (let column = 0; column < matrix.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < matrix.length; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][column]) <= EPSILON) {
      throw new Error("ellipse normal system is singular");
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let index = column; index <= matrix.length; index += 1) {
      augmented[column][index] /= divisor;
    }
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = augmented[row][column];
      for (let index = column; index <= matrix.length; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }
  return augmented.map((row) => row.at(-1));
}

function symmetricEigenvalues2(matrix) {
  const trace = matrix[0][0] + matrix[1][1];
  const delta = Math.sqrt((matrix[0][0] - matrix[1][1]) ** 2 + 4 * matrix[0][1] ** 2);
  return [(trace - delta) / 2, (trace + delta) / 2];
}

function symmetricEigenvectors2(matrix) {
  const values = symmetricEigenvalues2(matrix);
  const vectorFor = (value) => {
    const candidate = Math.abs(matrix[0][1]) > Math.abs(matrix[0][0] - value)
      ? [1, (value - matrix[0][0]) / matrix[0][1]]
      : [matrix[0][1], value - matrix[0][0]];
    const length = Math.hypot(...candidate);
    if (length <= EPSILON) {
      return value === values[0] ? [1, 0] : [0, 1];
    }
    return candidate.map((entry) => entry / length);
  };
  const first = vectorFor(values[0]);
  const second = [-first[1], first[0]];
  return { values, vectors: [[first[0], second[0]], [first[1], second[1]]] };
}

function inverse2(matrix) {
  const determinant = det2(matrix);
  return [
    [matrix[1][1] / determinant, -matrix[0][1] / determinant],
    [-matrix[1][0] / determinant, matrix[0][0] / determinant]
  ];
}

function det2(matrix) {
  return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
}

function multiply2Vector(matrix, vector) {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1]
  ];
}

function multiplyMatrices2(left, right) {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1]
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1]
    ]
  ];
}

function transpose2(matrix) {
  return [[matrix[0][0], matrix[1][0]], [matrix[0][1], matrix[1][1]]];
}

function scaleMatrix2(matrix, scalar) {
  return matrix.map((row) => row.map((value) => value * scalar));
}

function scale2(vector, scalar) {
  return vector.map((value) => value * scalar);
}

function quadratic(matrix, vector) {
  return vector.x * (matrix[0][0] * vector.x + matrix[0][1] * vector.y)
    + vector.y * (matrix[1][0] * vector.x + matrix[1][1] * vector.y);
}

function subtractPoint(point, center) {
  return { x: point.x - center.x, y: point.y - center.y };
}

function addVector(left, right) {
  return { x: left.x + right.x, y: left.y + right.y };
}

function frobenius2(matrix) {
  return Math.sqrt(matrix.flat().reduce((total, value) => total + value * value, 0));
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function median(values) {
  return quantile([...values].sort((left, right) => left - right), 0.5);
}

function quantile(sorted, probability) {
  if (sorted.length === 0) {
    return 0;
  }
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}
