"""Validate dashboard JSON artifacts before they are published."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_FILES = (
    "traffic_data.json",
    "aggregates.json",
    "quality_summary.json",
    "camera_records.json",
    "node_states.json",
    "performance_metrics.json",
)


def validate(directory: Path) -> list[str]:
    errors: list[str] = []
    for name in REQUIRED_FILES:
        path = directory / name
        if not path.exists():
            errors.append(f"missing: {path}")
            continue
        text = path.read_text(encoding="utf-8-sig")
        if any(marker in text for marker in ("<<<<<<<", "=======", ">>>>>>>")):
            errors.append(f"conflict marker found: {path}")
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON: {path} ({exc})")
            continue
        if name in {"traffic_data.json", "camera_records.json", "node_states.json"} and not isinstance(payload, list):
            errors.append(f"expected JSON array: {path}")
        if name in {"aggregates.json", "quality_summary.json", "performance_metrics.json"} and not isinstance(payload, dict):
            errors.append(f"expected JSON object: {path}")
    return errors


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("dashboard/public")
    errors = validate(directory)
    if errors:
        print("Dashboard JSON validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print(f"Dashboard JSON validation passed: {directory}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
