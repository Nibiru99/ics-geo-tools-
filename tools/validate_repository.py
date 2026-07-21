"""Validate the public ICS/GEO intake manifest without external dependencies."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "manifests" / "intake_queue.json"
ALLOWED_PUBLIC_STATUSES = {
    "validated",
    "supported",
    "experimental",
    "unconfirmed",
    "speculative",
    "appendix",
    "deprecated",
}
ALLOWED_INTAKE_STATUSES = {
    "candidate",
    "needs_source_review",
    "ready",
    "imported",
    "quarantined",
}
REQUIRED_FIELDS = {
    "id",
    "family",
    "source_id",
    "public_status",
    "intake_status",
    "evidence",
}


def validate() -> list[str]:
    errors: list[str] = []
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        return ["manifest entries must be a non-empty list"]

    seen_ids: set[str] = set()
    for index, entry in enumerate(entries):
        label = f"entries[{index}]"
        if not isinstance(entry, dict):
            errors.append(f"{label} must be an object")
            continue

        missing = REQUIRED_FIELDS - entry.keys()
        if missing:
            errors.append(f"{label} is missing: {', '.join(sorted(missing))}")
            continue

        entry_id = entry["id"]
        if entry_id in seen_ids:
            errors.append(f"duplicate id: {entry_id}")
        seen_ids.add(entry_id)

        if entry["public_status"] not in ALLOWED_PUBLIC_STATUSES:
            errors.append(f"{entry_id}: invalid public_status")
        if entry["intake_status"] not in ALLOWED_INTAKE_STATUSES:
            errors.append(f"{entry_id}: invalid intake_status")

        source_id = entry["source_id"]
        if Path(source_id).is_absolute() or re.match(r"^[A-Za-z]:[\\/]", source_id):
            errors.append(f"{entry_id}: source_id must be archive-relative")

    return errors


if __name__ == "__main__":
    validation_errors = validate()
    if validation_errors:
        for validation_error in validation_errors:
            print(f"ERROR: {validation_error}")
        raise SystemExit(1)
    print(f"OK: {MANIFEST.relative_to(ROOT)}")
