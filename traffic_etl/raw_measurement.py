from __future__ import annotations

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from .config import load_etl_config, load_nodes
from .extract import extract_osm_edges, extract_tomtom_flow, geocode_nodes, get_api_key
from .io import append_jsonl, append_table, write_json
from .schedule import parse_window


def run_raw_measurement(
    measurement_label: str,
    measurement_date: str | None = None,
    measurement_time: str | None = None,
    nodes_path: Path = Path("config/nodes.yaml"),
    etl_path: Path = Path("config/etl.yaml"),
    base_dir: Path = Path("outputs/raw_measurements"),
) -> dict:
    label = _sanitize_label(measurement_label)
    etl = load_etl_config(etl_path)
    nodes = load_nodes(nodes_path)
    api_key = get_api_key()
    actual_utc = datetime.now(timezone.utc).replace(microsecond=0)
    measurement_vn = _measurement_datetime_vn(measurement_date, measurement_time, etl.timezone)
    measurement_utc = measurement_vn.astimezone(timezone.utc)
    measurement_id = f"{measurement_vn.strftime('%Y%m%dT%H%M%S')}_VN_{label}"
    run_dir = base_dir / measurement_vn.strftime("%Y-%m-%d") / f"{measurement_vn.strftime('%H-%M-%S')}_{label}"
    run_dir.mkdir(parents=True, exist_ok=True)

    edge_nodes = geocode_nodes(nodes, api_key)
    tomtom_records = extract_tomtom_flow(edge_nodes, etl, api_key, run_dir)
    osm_records = extract_osm_edges(edge_nodes, run_dir)

    write_json(edge_nodes, run_dir / "edge_nodes.json")
    write_json(tomtom_records, run_dir / "tomtom_flow_records.json")
    write_json(osm_records, run_dir / "osm_edges.json")

    official_window = _matching_window(measurement_vn, etl.windows)
    metadata = {
        "measurement_id": measurement_id,
        "measurement_label": label,
        "measurement_date": measurement_vn.strftime("%Y-%m-%d"),
        "measurement_time": measurement_vn.strftime("%H:%M:%S"),
        "collected_at_vn": measurement_vn.isoformat(),
        "collected_at_utc": measurement_utc.isoformat(),
        "collected_at_actual_utc": actual_utc.isoformat(),
        "collection_type": "manual_raw_measurement",
        "is_official_collection_window": official_window is not None,
        "official_window": official_window or "",
        "tomtom_mode": "live_current_flow" if api_key else "synthetic_fallback",
        "node_count": len(edge_nodes),
        "sample_count": len(tomtom_records),
        "raw_dir": str(run_dir),
        "outputs": {
            "metadata": str(run_dir / "metadata.json"),
            "edge_nodes": str(run_dir / "edge_nodes.json"),
            "tomtom_flow_records": str(run_dir / "tomtom_flow_records.json"),
            "osm_edges": str(run_dir / "osm_edges.json"),
        },
    }
    write_json(metadata, run_dir / "metadata.json")
    _append_index(metadata, base_dir)
    return metadata


def _append_index(metadata: dict, base_dir: Path) -> None:
    index_record = {
        "measurement_id": metadata["measurement_id"],
        "measurement_label": metadata["measurement_label"],
        "measurement_date": metadata["measurement_date"],
        "measurement_time": metadata["measurement_time"],
        "collected_at_vn": metadata["collected_at_vn"],
        "collected_at_utc": metadata["collected_at_utc"],
        "collected_at_actual_utc": metadata["collected_at_actual_utc"],
        "collection_type": metadata["collection_type"],
        "is_official_collection_window": metadata["is_official_collection_window"],
        "official_window": metadata["official_window"],
        "tomtom_mode": metadata["tomtom_mode"],
        "node_count": metadata["node_count"],
        "sample_count": metadata["sample_count"],
        "raw_dir": metadata["raw_dir"],
    }
    append_table(pd.DataFrame([index_record]), base_dir / "index.csv")
    append_jsonl([index_record], base_dir / "index.jsonl")


def _sanitize_label(label: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", label.strip())
    cleaned = cleaned.strip("_")
    if not cleaned:
        raise ValueError("measurement_label must contain at least one letter or number")
    return cleaned[:80]


def _measurement_datetime_vn(
    measurement_date: str | None,
    measurement_time: str | None,
    timezone_name: str,
) -> datetime:
    tz = ZoneInfo(timezone_name)
    if not measurement_date and not measurement_time:
        return datetime.now(tz).replace(microsecond=0)
    if not measurement_date or not measurement_time:
        raise ValueError("measurement_date and measurement_time must be provided together")
    raw_time = measurement_time.strip()
    if len(raw_time.split(":")) == 2:
        raw_time = f"{raw_time}:00"
    try:
        return datetime.fromisoformat(f"{measurement_date.strip()}T{raw_time}").replace(tzinfo=tz)
    except ValueError as exc:
        raise ValueError("Use measurement_date=YYYY-MM-DD and measurement_time=HH:MM or HH:MM:SS") from exc


def _matching_window(now_vn: datetime, windows: list[str]) -> str | None:
    current = now_vn.time()
    for window in windows:
        start, end = parse_window(window)
        if start <= current <= end:
            return window
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect raw TomTom/OSM data for one manual measurement.")
    parser.add_argument("--measurement-label", required=True)
    parser.add_argument("--measurement-date", help="Vietnam date in YYYY-MM-DD format")
    parser.add_argument("--measurement-time", help="Vietnam time in HH:MM or HH:MM:SS format")
    parser.add_argument("--nodes", default="config/nodes.yaml")
    parser.add_argument("--etl", default="config/etl.yaml")
    parser.add_argument("--base-dir", default="outputs/raw_measurements")
    args = parser.parse_args()
    metadata = run_raw_measurement(
        measurement_label=args.measurement_label,
        measurement_date=args.measurement_date,
        measurement_time=args.measurement_time,
        nodes_path=Path(args.nodes),
        etl_path=Path(args.etl),
        base_dir=Path(args.base_dir),
    )
    print(f"measurement_id={metadata['measurement_id']}")
    print(f"raw_dir={metadata['raw_dir']}")
    print(f"tomtom_mode={metadata['tomtom_mode']}")
