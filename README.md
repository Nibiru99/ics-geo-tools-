# ICS / GEO Tools

Executable, evidence-bounded utilities for the Infinity Counting Sphere (ICS),
GEO X, and geometry-addressed symbolic-memory research program.

This repository is the public execution lane for selected experiments. It is not
the raw project archive and it does not mirror the private Obsidian vault.

## Repository Contract

An experiment enters this repository only when its runnable source, parameters,
seed handling, result manifest, and evidence status can be reviewed together.
Generated outputs remain reproducible artifacts rather than undocumented claims.

The initial intake queue lives in
[`manifests/intake_queue.json`](manifests/intake_queue.json). Candidate source IDs
are archive-relative labels; local workstation paths are intentionally excluded.

## Current Executable Scope

The first reconstruction concerns ICS v3 Experiments 4 and 4B. It separates two
questions:

1. **Archival replay:** can the published branch rows reproduce the documented
   CEI calculations, rankings, and aggregate metrics?
2. **Independent stress test:** does adding explicit goal progress repair the
   documented no-op/reordering failure mode in a new deterministic benchmark?

The historical packages contain preserved outputs, but their Python entry points
are placeholders. This repository therefore does **not** claim to reproduce the
original generators. It provides a clean-room metric replay and a new adversarial
benchmark with a frozen acceptance contract.

The first robustness extension deliberately preserves a failed preregistered
condition: with goal-signal reliability reduced to zero, the patched scorer still
selected the expected branch in 64% of tasks, above the frozen 55% ceiling. Other
correlated state and penalty features therefore leak part of the answer. A failed
hypothesis contract is recorded as a result and does not make the software test
suite fail.

This repository is research software package `v0.2.0`. That package version is
not the version number of the complete ICS theory or manuscript. It is the second
executable-tool stage derived from the v3 Experiment 4/4B evidence.

## Layout

```text
docs/          repository scope and evidence rules
experiments/   reviewed, self-contained experiment packages
fixtures/      frozen reconstruction inputs
manifests/     intake and provenance records
outputs/       curated validation artifacts
release/       checksums and publication metadata
results/       reproducible experiment reports
src/           executable reconstruction and audit modules
test/          deterministic software and contract tests
tools/         repository validation utilities
```

## Run

Requires Node.js 20 or newer. There are no runtime dependencies.

```bash
npm test
npm run reproduce
python tools/validate_repository.py
```

Generated reports are written to `results/`.

## Evidence Boundary

- The archival replay tests the metric layer from preserved v3 Experiment 4/4B rows.
- The stress benchmark tests a newly specified synthetic task family; it is not a
  reconstruction of the historical data generator.
- Results support software-behaviour claims only. They do not establish physical,
  cosmological, quantum, cognitive, or consciousness mechanisms.

## Licensing

This is a mixed-license research repository:

- executable source, tests, and software configuration: [Apache License 2.0](LICENSE);
- documentation, fixtures, stored results, and explanatory material:
  [Creative Commons Attribution 4.0 International](LICENSES/CC-BY-4.0.txt).

See [LICENSES.md](LICENSES.md) for the exact path-level allocation and attribution
requirements. Copyright 2026 David Glowalla.

## Release State

`v0.2.0` is prepared on a draft pull request. It is not yet a tagged release or
Zenodo deposit. See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
