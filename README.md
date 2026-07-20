# ICS / GEO Tools

Executable, evidence-bounded utilities for the Infinity Counting Sphere (ICS) and geometry-addressed symbolic-memory research programme.

The first reconstruction in this repository concerns ICS v3 Experiments 4 and 4B. It separates two questions:

1. **Archival replay:** can the published branch rows reproduce the documented CEI calculations, rankings, and aggregate metrics?
2. **Independent stress test:** does adding explicit goal progress repair the documented no-op/reordering failure mode in a new deterministic benchmark?

The historical packages contain preserved outputs, but their Python entry points are placeholders. This repository therefore does **not** claim to reproduce the original generators. It provides a clean-room metric replay and a new adversarial benchmark with a frozen acceptance contract.

The first robustness extension deliberately preserves a failed preregistered condition: with goal-signal reliability reduced to zero, the patched scorer still selected the expected branch in 64% of tasks, above the frozen 55% ceiling. Other correlated state and penalty features therefore leak part of the answer. A failed hypothesis contract is recorded as a result and does not make the software test suite fail.

## Run

Requires Node.js 20 or newer. There are no runtime dependencies.

```bash
npm test
npm run reproduce
```

Generated reports are written to `results/`.

## Evidence boundary

- The archival replay tests the metric layer from preserved v3 Experiment 4/4B rows.
- The stress benchmark tests a newly specified synthetic task family; it is not a reconstruction of the historical data generator.
- Results support software-behaviour claims only. They do not establish physical, cosmological, quantum, cognitive, or consciousness mechanisms.

## License

No license has been selected yet. Until the repository owner adds one, normal copyright applies and reuse permission is not granted.
