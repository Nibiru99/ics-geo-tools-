# Repository Scope

## Included

- Runnable ICS AP and GEO X experiment packages selected from the private archive.
- Fixed parameters, deterministic seeds, and dependency declarations.
- Machine-readable result manifests and compact reference fixtures.
- Self-checks, corruption controls, baseline comparisons, and replication notes.
- Evidence labels from the shared UTOPIA status vocabulary.

## Excluded

- The complete Obsidian vault or unsorted research tray.
- Personal notes, local absolute paths, credentials, and private data.
- PAC/PAM application internals that belong in `pam-pac-core`.
- Large generated result trees without a deliberate publication review.
- Documents whose license or publication state has not been resolved.

## Experiment Intake Gate

Every imported experiment must provide:

1. A README with the question, method, parameters, and exact run command.
2. Runnable source with explicit seed handling.
3. A machine-readable manifest naming expected outputs.
4. At least one self-check or baseline comparison.
5. An evidence status: `validated`, `supported`, `experimental`, `unconfirmed`,
   `speculative`, `appendix`, or `deprecated`.
6. A short result summary that distinguishes observations from interpretation.

An intake candidate remains a candidate until those materials agree with the
archived run and reproduce in a clean checkout.
