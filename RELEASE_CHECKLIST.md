# v0.2.0 release checklist

## Completed

- [x] primary contract frozen before accepted result;
- [x] secondary robustness contract frozen before its result;
- [x] failed zero-signal condition retained without threshold tuning;
- [x] five software tests pass from a fresh checkout;
- [x] canonical result checksum recorded;
- [x] code assigned Apache-2.0;
- [x] documentation, fixtures, and results assigned CC BY 4.0;
- [x] `CITATION.cff` and `.zenodo.json` prepared;
- [x] claim and non-claim boundaries documented.
- [x] official creator attribution confirmed as `David Glowalla`.

## Before tagging

- [ ] review and merge the draft pull request;
- [ ] confirm that every archived fixture is owned or otherwise licensable by
  the repository owner;
- [ ] regenerate the result from the merged commit;
- [ ] verify the SHA-256 value in `release/checksums.sha256`;
- [ ] change the changelog entry from `Unreleased` to the release date.

## Publication

- [ ] create annotated tag `v0.2.0`;
- [ ] create the GitHub release from that tag;
- [ ] enable or manually create the Zenodo software archive;
- [ ] insert the software DOI into `CITATION.cff`, `.zenodo.json`, and the
  ICS manuscript;
- [ ] verify license, creator, related identifier, files, and access state in
  the unpublished Zenodo draft;
- [ ] publish only after the exact Zenodo preview is approved.
