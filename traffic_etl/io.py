from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


def ensure_dirs(base_dir: Path) -> dict[str, Path]:
    dirs = {
        "raw": base_dir / "raw",
        "processed": base_dir / "processed",
        "report": base_dir / "report",
        "charts": base_dir / "report" / "charts",
        "history": base_dir / "history",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def write_table(df: pd.DataFrame, path_without_ext: Path) -> dict[str, str]:
    outputs: dict[str, str] = {}
    path_without_ext.parent.mkdir(parents=True, exist_ok=True)
    csv_path = path_without_ext.with_suffix(".csv")
    json_path = path_without_ext.with_suffix(".json")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    df.to_json(json_path, orient="records", force_ascii=False, indent=2)
    outputs["csv"] = str(csv_path)
    outputs["json"] = str(json_path)
    try:
        parquet_path = path_without_ext.with_suffix(".parquet")
        df.to_parquet(parquet_path, index=False)
        outputs["parquet"] = str(parquet_path)
    except Exception as exc:
        parquet_path = path_without_ext.with_suffix(".parquet")
        if parquet_path.exists():
            parquet_path.unlink()
        outputs["parquet_unavailable"] = type(exc).__name__
    return outputs


def write_json(data: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def append_table(df: pd.DataFrame, path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not path.exists()
    df.to_csv(path, mode="a", index=False, header=write_header, encoding="utf-8-sig")
    return str(path)


def append_jsonl(records: list[dict[str, Any]], path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return str(path)
