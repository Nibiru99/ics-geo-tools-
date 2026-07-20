export function intervalProgressions(n, k = 3) {
  requirePositiveInteger(n, "n");
  requirePositiveInteger(k, "k");
  if (k < 3) {
    throw new RangeError("k must be at least 3");
  }
  const vertices = Array.from({ length: n }, (_, index) => index + 1);
  const edges = [];
  for (let difference = 1; 1 + (k - 1) * difference <= n; difference += 1) {
    for (let start = 1; start + (k - 1) * difference <= n; start += 1) {
      edges.push(Array.from({ length: k }, (_, term) => start + term * difference));
    }
  }
  return createHypergraph(`interval_[${n}]_${k}AP`, vertices, edges);
}

export function cyclicThreeProgressions(n) {
  requirePositiveInteger(n, "n");
  if (n < 3) {
    throw new RangeError("n must be at least 3");
  }
  const vertices = Array.from({ length: n }, (_, index) => index);
  const edges = [];
  for (let start = 0; start < n; start += 1) {
    for (let difference = 1; difference < n; difference += 1) {
      const edge = [start, mod(start + difference, n), mod(start + 2 * difference, n)];
      if (new Set(edge).size === 3) {
        edges.push(edge);
      }
    }
  }
  return createHypergraph(`cyclic_Z${n}_3AP`, vertices, edges);
}

export function finiteFieldThreeProgressions(prime, dimension) {
  requirePositiveInteger(prime, "prime");
  requirePositiveInteger(dimension, "dimension");
  if (prime === 2 || !isPrime(prime)) {
    throw new RangeError("prime must be an odd prime");
  }
  const vertexCount = prime ** dimension;
  const vertices = Array.from({ length: vertexCount }, (_, index) => index);
  const edges = [];
  for (let start = 0; start < vertexCount; start += 1) {
    const startVector = decodePoint(start, prime, dimension);
    for (let difference = 1; difference < vertexCount; difference += 1) {
      const differenceVector = decodePoint(difference, prime, dimension);
      edges.push([
        start,
        encodePoint(addFieldVectors(startVector, differenceVector, prime), prime),
        encodePoint(addFieldVectors(startVector, scaleFieldVector(differenceVector, 2, prime), prime), prime)
      ]);
    }
  }
  return createHypergraph(`finite_field_F${prime}^${dimension}_3AP`, vertices, edges);
}

export function createHypergraph(name, vertices, inputEdges) {
  const vertexIndex = new Map(vertices.map((vertex, index) => [String(vertex), index]));
  if (vertexIndex.size !== vertices.length) {
    throw new Error("vertices must be unique under string encoding");
  }
  const edgeMap = new Map();
  let uniformity = null;
  for (const inputEdge of inputEdges) {
    const edge = [...inputEdge];
    if (uniformity === null) {
      uniformity = edge.length;
    }
    if (edge.length !== uniformity || new Set(edge.map(String)).size !== edge.length) {
      throw new Error("edges must be uniform and contain distinct vertices");
    }
    const indices = edge.map((vertex) => {
      const index = vertexIndex.get(String(vertex));
      if (index === undefined) {
        throw new Error(`unknown edge vertex: ${vertex}`);
      }
      return index;
    }).sort((left, right) => left - right);
    const key = indices.join(":");
    edgeMap.set(key, indices);
  }
  const indexedEdges = [...edgeMap.values()].sort(lexicographicArrayCompare);
  const edgeMasks = indexedEdges.map(indicesToMask);
  const degrees = Array(vertices.length).fill(0);
  for (const edge of indexedEdges) {
    for (const index of edge) {
      degrees[index] += 1;
    }
  }
  return Object.freeze({
    name,
    vertices: Object.freeze([...vertices]),
    vertexIndex,
    uniformity: uniformity ?? 0,
    indexedEdges: Object.freeze(indexedEdges.map((edge) => Object.freeze(edge))),
    edgeMasks: Object.freeze(edgeMasks),
    degrees: Object.freeze(degrees)
  });
}

export function analyzeMask(hypergraph, mask) {
  const selected = normalizeMask(mask, hypergraph.vertices.length);
  const completionGradient = Array(hypergraph.vertices.length).fill(0);
  const legacyLocalNumerators = Array(hypergraph.vertices.length).fill(0);
  let completedCount = 0;
  let oneHoleCount = 0;
  let legacyOccupancy = 0;
  for (let edgeIndex = 0; edgeIndex < hypergraph.indexedEdges.length; edgeIndex += 1) {
    const edge = hypergraph.indexedEdges[edgeIndex];
    const edgeMask = hypergraph.edgeMasks[edgeIndex];
    const occupancy = popcount(selected & edgeMask);
    legacyOccupancy += occupancy;
    if (occupancy === hypergraph.uniformity) {
      completedCount += 1;
    }
    if (occupancy === hypergraph.uniformity - 1) {
      oneHoleCount += 1;
      const missing = edge.find((index) => !hasVertex(selected, index));
      completionGradient[missing] += 1;
    }
    for (const index of edge) {
      legacyLocalNumerators[index] += occupancy - (hasVertex(selected, index) ? 1 : 0);
    }
  }
  const legacyNumerator = legacyLocalNumerators.reduce((total, value) => total + value, 0);
  const legacyPressure = hypergraph.uniformity
    ? legacyNumerator / (hypergraph.uniformity - 1)
    : 0;
  const degreeWeightedOccupancy = hypergraph.degrees.reduce((total, degree, index) => {
    return total + (hasVertex(selected, index) ? degree : 0);
  }, 0);
  return {
    mask: selected,
    size: popcount(selected),
    completedCount,
    completionGradient,
    globalCompletionPressure: completionGradient.reduce((total, value) => total + value, 0),
    oneHoleCount,
    legacyLocalNumerators,
    legacyNumerator,
    legacyPressure,
    legacyOccupancy,
    degreeWeightedOccupancy,
    progressionFree: completedCount === 0,
    maximalProgressionFree: completedCount === 0 && completionGradient.every((value, index) => {
      return hasVertex(selected, index) || value > 0;
    })
  };
}

export function addVertex(mask, vertexIndex) {
  return BigInt(mask) | (1n << BigInt(vertexIndex));
}

export function hasVertex(mask, vertexIndex) {
  return (BigInt(mask) & (1n << BigInt(vertexIndex))) !== 0n;
}

export function maskToVertices(hypergraph, mask) {
  return hypergraph.vertices.filter((_, index) => hasVertex(mask, index));
}

export function exhaustiveIntervalSummary(n, k = 3) {
  const hypergraph = intervalProgressions(n, k);
  const subsetCount = 1n << BigInt(n);
  let progressionFreeCount = 0;
  let maximalProgressionFreeCount = 0;
  let maximumProgressionFreeSize = -1;
  let minimumMaximalProgressionFreeSize = Number.POSITIVE_INFINITY;
  let maximumWitness = 0n;
  let minimumMaximalWitness = 0n;
  const legacyBuckets = new Map();
  let sameLegacyDifferentCompletion = null;
  let sameSizeLegacyDifferentCompletion = null;
  for (let mask = 0n; mask < subsetCount; mask += 1n) {
    const analysis = analyzeMask(hypergraph, mask);
    if (analysis.progressionFree) {
      progressionFreeCount += 1;
      if (analysis.size > maximumProgressionFreeSize) {
        maximumProgressionFreeSize = analysis.size;
        maximumWitness = mask;
      }
    }
    if (analysis.maximalProgressionFree) {
      maximalProgressionFreeCount += 1;
      if (analysis.size < minimumMaximalProgressionFreeSize) {
        minimumMaximalProgressionFreeSize = analysis.size;
        minimumMaximalWitness = mask;
      }
    }
    const legacyKey = String(analysis.legacyPressure);
    const sizeLegacyKey = `${analysis.size}:${legacyKey}`;
    sameLegacyDifferentCompletion ||= findCollision(legacyBuckets, legacyKey, analysis, mask);
    sameSizeLegacyDifferentCompletion ||= findCollision(legacyBuckets, sizeLegacyKey, analysis, mask);
  }
  return {
    domain: hypergraph.name,
    vertexCount: n,
    edgeCount: hypergraph.indexedEdges.length,
    subsetCount: Number(subsetCount),
    progressionFreeCount,
    maximalProgressionFreeCount,
    maximumProgressionFreeSize,
    maximumWitness: maskToVertices(hypergraph, maximumWitness),
    minimumMaximalProgressionFreeSize: Number.isFinite(minimumMaximalProgressionFreeSize)
      ? minimumMaximalProgressionFreeSize
      : null,
    minimumMaximalWitness: Number.isFinite(minimumMaximalProgressionFreeSize)
      ? maskToVertices(hypergraph, minimumMaximalWitness)
      : null,
    sameLegacyDifferentCompletion,
    sameSizeLegacyDifferentCompletion
  };
}

function findCollision(buckets, key, analysis, mask) {
  const prior = buckets.get(key);
  if (!prior) {
    buckets.set(key, {
      mask,
      size: analysis.size,
      completedCount: analysis.completedCount,
      globalCompletionPressure: analysis.globalCompletionPressure,
      legacyPressure: analysis.legacyPressure
    });
    return null;
  }
  if (prior.completedCount === analysis.completedCount
      && prior.globalCompletionPressure === analysis.globalCompletionPressure) {
    return null;
  }
  return {
    legacyPressure: analysis.legacyPressure,
    left: {
      mask: prior.mask.toString(),
      size: prior.size,
      completedCount: prior.completedCount,
      globalCompletionPressure: prior.globalCompletionPressure
    },
    right: {
      mask: mask.toString(),
      size: analysis.size,
      completedCount: analysis.completedCount,
      globalCompletionPressure: analysis.globalCompletionPressure
    }
  };
}

function normalizeMask(mask, vertexCount) {
  const value = BigInt(mask);
  if (value < 0n || value >= (1n << BigInt(vertexCount))) {
    throw new RangeError("mask is outside the hypergraph vertex range");
  }
  return value;
}

function indicesToMask(indices) {
  return indices.reduce((mask, index) => mask | (1n << BigInt(index)), 0n);
}

function popcount(input) {
  let value = BigInt(input);
  let count = 0;
  while (value) {
    value &= value - 1n;
    count += 1;
  }
  return count;
}

function decodePoint(index, prime, dimension) {
  const coordinates = [];
  let value = index;
  for (let axis = 0; axis < dimension; axis += 1) {
    coordinates.push(value % prime);
    value = Math.floor(value / prime);
  }
  return coordinates;
}

function encodePoint(coordinates, prime) {
  return coordinates.reduceRight((value, coordinate) => value * prime + coordinate, 0);
}

function addFieldVectors(left, right, prime) {
  return left.map((value, index) => mod(value + right[index], prime));
}

function scaleFieldVector(vector, scalar, prime) {
  return vector.map((value) => mod(value * scalar, prime));
}

function mod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function lexicographicArrayCompare(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return left.length - right.length;
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
}

function isPrime(value) {
  if (value < 2) {
    return false;
  }
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) {
      return false;
    }
  }
  return true;
}
