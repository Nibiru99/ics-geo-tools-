# Experiments

Reviewed experiment packages will be added here by family:

```text
experiments/
  ics-ap/
  geo-x/
```

Each package should be independently runnable and should write generated data to
its own ignored `outputs/` directory. Reference fixtures may be committed only
when they are small, documented, and required by a self-check.

The first proposed imports are listed in `manifests/intake_queue.json`. The queue
is an audit aid, not an assertion that every candidate is publication-ready.
