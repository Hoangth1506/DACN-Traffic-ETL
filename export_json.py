"""
export_json.py — Convert parquet outputs → JSON files cho React dashboard v2.

Output vào dashboard/public/:
    traffic_data.json       — unified records (camera level)
    camera_records.json     — Layer 1: CameraRecords
    node_states.json        — Layer 2: NodeStates (fused)
    performance_metrics.json — Layer 3: 4 nhom chi so
    aggregates.json         — pre-computed summaries
    quality_summary.json    — quality metrics
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent
PARQUET = BASE / "outputs" / "unified_traffic.parquet"
QUALITY_JSON = BASE / "outputs" / "quality_report.json"
OUT_DIR = BASE / "dashboard" / "public"

NODE_META = {
    "N01_LY_THUONG_KIET": {"name": "Ly Thuong Kiet", "lat": 10.770501, "lon": 106.658107, "radius_m": 900},
    "N02_CONG_HOA":        {"name": "Cong Hoa",        "lat": 10.800431, "lon": 106.661012, "radius_m": 1200},
    "N03_TRUONG_CHINH":    {"name": "Truong Chinh",    "lat": 10.806527, "lon": 106.635795, "radius_m": 1200},
}


def _clean(obj):
    """Recursively replace NaN/inf/None với null-safe values."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    return obj


def export_traffic_data(df: pd.DataFrame, out_dir: Path) -> None:
    """Export full records sang traffic_data.json."""
    keep_cols = [
        "session_id", "node_id", "node_name", "sample_id",
        "matched_road_name", "osm_name", "highway",
        "sample_lat", "sample_lon", "centroid_lat", "centroid_lon",
        "current_speed", "free_flow_speed", "confidence",
        "congestion_index", "speed_ratio", "los", "is_congested",
        "time_slot", "date_str", "hour_vn",
        "current_travel_time", "free_flow_travel_time", "delay_index",
        "segment_length_km", "frc", "road_class_label",
        "lanes", "oneway", "maxspeed_kmh",
        "osm_matched", "osm_distance_m",
        "extracted_at",
    ]
    cols = [c for c in keep_cols if c in df.columns]
    out = df[cols].copy()

    # Serialize
    for col in out.select_dtypes(include=["datetime64[ns]", "datetimetz"]).columns:
        out[col] = out[col].astype(str)
    out["is_congested"] = out["is_congested"].astype(bool)
    out["osm_matched"]  = out["osm_matched"].fillna(False).astype(bool)

    records = _clean(out.replace({float("nan"): None}).to_dict(orient="records"))

    path = out_dir / "traffic_data.json"
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"traffic_data.json: {len(records)} records → {path}")


def export_aggregates(df: pd.DataFrame, out_dir: Path) -> None:
    """Export pre-computed aggregates sang aggregates.json."""
    agg = {}

    # ── 1. By node ──────────────────────────────────────────────────────────
    by_node = {}
    for nid, g in df.groupby("node_id"):
        by_node[nid] = {
            "meta": NODE_META.get(nid, {}),
            "records": int(len(g)),
            "avg_speed": _round(g["current_speed"].mean()),
            "std_speed": _round(g["current_speed"].std()),
            "min_speed": _round(g["current_speed"].min()),
            "max_speed": _round(g["current_speed"].max()),
            "avg_congestion_index": _round(g["congestion_index"].mean()),
            "pct_congested": _round(g["is_congested"].mean() * 100),
            "osm_match_pct": _round(g["osm_matched"].fillna(False).mean() * 100),
            "los_distribution": g["los"].value_counts().to_dict(),
        }
    agg["by_node"] = by_node

    # ── 2. By date ────────────────────────────────────────────────────────────
    by_date = {}
    for date, g in df.groupby("date_str"):
        by_date[str(date)] = {
            "records": int(len(g)),
            "avg_speed": _round(g["current_speed"].mean()),
            "pct_congested": _round(g["is_congested"].mean() * 100),
            "by_node": {
                nid: _round(ng["current_speed"].mean())
                for nid, ng in g.groupby("node_id")
            },
        }
    agg["by_date"] = by_date

    # ── 3. Speed by time_slot × node ─────────────────────────────────────────
    slot_node = {}
    for slot, g in df.groupby("time_slot"):
        slot_node[str(slot)] = {
            nid: _round(ng["current_speed"].mean())
            for nid, ng in g.groupby("node_id")
        }
    agg["speed_by_slot_node"] = slot_node

    # ── 4. Heatmap: avg_speed[date][hour] ─────────────────────────────────────
    heatmap = {}
    if "hour_vn" in df.columns and "date_str" in df.columns:
        h = df.groupby(["date_str", "hour_vn"])["current_speed"].mean().round(1)
        for (date, hour), val in h.items():
            d = str(date)
            heatmap.setdefault(d, {})[int(hour)] = _clean(float(val))
    agg["heatmap_speed"] = heatmap

    # ── 5. Per-road speed profile (for Velocity Estimator) ───────────────────
    road_profiles = {}
    road_col = "matched_road_name"
    if road_col in df.columns:
        roads = df[road_col].dropna().unique()
        for road in roads:
            if not road or road == "":
                continue
            rdf = df[df[road_col] == road].sort_values("extracted_at")
            road_profiles[road] = {
                "node_id": rdf["node_id"].iloc[0] if not rdf.empty else "",
                "records": int(len(rdf)),
                "avg_speed": _round(rdf["current_speed"].mean()),
                "std_speed": _round(rdf["current_speed"].std()),
                "data": [
                    {
                        "session": str(row.get("session_id", ""))[-12:],
                        "date": str(row.get("date_str", "")),
                        "hour": int(row["hour_vn"]) if pd.notna(row.get("hour_vn")) else None,
                        "time_slot": str(row.get("time_slot", "")),
                        "speed": _clean(float(row["current_speed"])) if pd.notna(row.get("current_speed")) else None,
                        "free_flow": _clean(float(row["free_flow_speed"])) if pd.notna(row.get("free_flow_speed")) else None,
                        "los": str(row.get("los", "")),
                        "congestion_index": _clean(float(row["congestion_index"])) if pd.notna(row.get("congestion_index")) else None,
                    }
                    for _, row in rdf.iterrows()
                ],
            }
    agg["road_profiles"] = road_profiles

    # ── 6. Node list ──────────────────────────────────────────────────────────
    agg["nodes"] = [
        {"id": nid, **meta}
        for nid, meta in NODE_META.items()
    ]

    # ── 7. Date range ─────────────────────────────────────────────────────────
    dates = sorted(df["date_str"].dropna().unique().tolist())
    agg["date_range"] = {"min": dates[0], "max": dates[-1], "all": dates}

    # ── 8. Flow indicators (matched records only) ─────────────────────────────
    matched = df[df["osm_matched"].fillna(False)].copy()
    if not matched.empty and "lanes" in matched.columns:
        matched["lanes_n"] = pd.to_numeric(matched["lanes"], errors="coerce")
        matched["flow_rate"] = matched["current_speed"] * matched["lanes_n"]
        flow_by_node = {}
        for nid, g in matched.groupby("node_id"):
            flow_by_node[nid] = _round(g["flow_rate"].mean())
        agg["avg_flow_rate_by_node"] = flow_by_node

    path = out_dir / "aggregates.json"
    path.write_text(json.dumps(_clean(agg), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"aggregates.json → {path}")


def export_quality(out_dir: Path) -> None:
    """Copy quality_report.json → quality_summary.json."""
    if not QUALITY_JSON.exists():
        print("quality_report.json not found, skipping")
        return
    data = json.loads(QUALITY_JSON.read_text(encoding="utf-8"))
    path = out_dir / "quality_summary.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"quality_summary.json → {path}")


def export_camera_records(out_dir: Path) -> None:
    """Export camera_records.parquet → camera_records.json."""
    path_parquet = BASE / "outputs" / "camera_records.parquet"
    if not path_parquet.exists():
        print("camera_records.parquet not found, skipping")
        return
    df = pd.read_parquet(path_parquet)
    # Keep useful columns only (skip heavy repeated cols)
    keep = ["session_id", "node_id", "node_short", "camera_id", "road_segment",
            "lat", "lon", "velocity", "free_flow_velocity", "density",
            "image_quality", "reliability", "los", "is_congested",
            "time_slot", "date_str", "hour_vn", "frc", "osm_matched",
            "segment_length_km", "delay_index", "speed_ratio"]
    cols = [c for c in keep if c in df.columns]
    out = df[cols].copy()
    out["is_congested"] = out["is_congested"].fillna(False).astype(bool)
    out["osm_matched"]  = out["osm_matched"].fillna(False).astype(bool)
    records = _clean(out.replace({float("nan"): None}).to_dict(orient="records"))
    path = out_dir / "camera_records.json"
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"camera_records.json: {len(records)} records")


def export_node_states(out_dir: Path) -> None:
    """Export node_states.parquet → node_states.json."""
    path_parquet = BASE / "outputs" / "node_states.parquet"
    if not path_parquet.exists():
        print("node_states.parquet not found, skipping")
        return
    df = pd.read_parquet(path_parquet)
    # Convert camera_positions (list of ndarray) → list of [lat, lon]
    if "camera_positions" in df.columns:
        df["camera_positions"] = df["camera_positions"].apply(
            lambda pos: [[float(p[0]), float(p[1])] for p in pos] if isinstance(pos, (list, np.ndarray)) and len(pos) > 0 else []
        )
    records = _clean(df.replace({float("nan"): None}).to_dict(orient="records"))
    path = out_dir / "node_states.json"
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"node_states.json: {len(records)} node states")


def export_performance(out_dir: Path) -> None:
    """Copy performance_metrics.json → dashboard/public/."""
    src = BASE / "outputs" / "performance_metrics.json"
    if not src.exists():
        print("performance_metrics.json not found, skipping")
        return
    data = json.loads(src.read_text(encoding="utf-8"))
    path = out_dir / "performance_metrics.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"performance_metrics.json → {path}")


def _round(x, n=2):
    try:
        v = float(x)
        return None if (math.isnan(v) or math.isinf(v)) else round(v, n)
    except (TypeError, ValueError):
        return None


def main():
    if not PARQUET.exists():
        print(f"ERROR: {PARQUET} not found. Run 'python etl/generate_data.py' first.")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Loading {PARQUET}...")
    df = pd.read_parquet(PARQUET)
    print(f"  {len(df)} rows, {len(df.columns)} columns")

    # Fix boolean columns
    df["is_congested"] = df["is_congested"].fillna(False)
    df["osm_matched"]  = df["osm_matched"].fillna(False)

    export_traffic_data(df, OUT_DIR)
    export_aggregates(df, OUT_DIR)
    export_quality(OUT_DIR)
    export_camera_records(OUT_DIR)
    export_node_states(OUT_DIR)
    export_performance(OUT_DIR)
    print("\nDone! All JSON files ready in dashboard/public/")


if __name__ == "__main__":
    main()
