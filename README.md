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

## Layout

```text
docs/          repository scope and evidence rules
experiments/   reviewed, self-contained experiment packages
manifests/     intake and provenance records
tools/         repository validation utilities
```

## Validate

```bash
python tools/validate_repository.py
```

Development changes should be reviewed before publication. No license has been
selected yet; until the repository owner adds one, normal copyright applies.
