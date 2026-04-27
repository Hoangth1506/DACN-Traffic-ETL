from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from .config import EtlConfig


def los_from_velocity(velocity: float | None) -> str:
    if velocity is None or pd.isna(velocity):
        return "unknown"
    if velocity < 7:
        return "F"
    if velocity < 13:
        return "E"
    if velocity < 20:
        return "D"
    if velocity < 30:
        return "C"
    if velocity < 35:
        return "B"
    return "A"


def congestion_level(
    congestion_ratio: float | None,
    road_closed: bool = False,
    velocity_kmph: float | None = None,
) -> str:
    if road_closed:
        return "closed"
    if congestion_ratio is None or pd.isna(congestion_ratio):
        return "unknown"
    if velocity_kmph is not None and not pd.isna(velocity_kmph):
        if velocity_kmph < 13:
            return "un_tac"
        if velocity_kmph < 20:
            return "dong"
        if velocity_kmph < 30:
            return "trung_binh"
    if congestion_ratio < 0.2:
        return "thoang"
    if congestion_ratio < 0.45:
        return "trung_binh"
    if congestion_ratio < 0.7:
        return "dong"
    return "un_tac"


def transform_tomtom_records(records: list[dict[str, Any]], etl: EtlConfig) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    for record in records:
        segment = record.get("flowSegmentData") or {}
        current = _as_float(segment.get("currentSpeed"))
        free = _as_float(segment.get("freeFlowSpeed"))
        confidence = _as_float(segment.get("confidence"))
        if confidence is None:
            confidence = 0.5 if record.get("source_name") == "synthetic_fallback" else 0.7
        road_closed = bool(segment.get("roadClosure", False))
        ratio = None
        if current is not None and free and free > 0:
            ratio = max(0.0, min(1.0, 1.0 - current / free))
        extracted = _parse_dt(record["extracted_at"])
        age_minutes = max(0.0, (now - extracted).total_seconds() / 60.0)
        recency = max(0.0, 1.0 - age_minutes / etl.recency_window_minutes)
        source_name = record.get("source_name", "unknown")
        source_quality = etl.source_quality.get(source_name, etl.source_quality["synthetic_fallback"])
        density_proxy = None if ratio is None else round(ratio * 30.0, 4)
        rows.append(
            {
                "node_id": record["node_id"],
                "node_name": record["node_name"],
                "sample_id": record["sample_id"],
                "lat": record["lat"],
                "lon": record["lon"],
                "sampling_method": record.get("sampling_method", ""),
                "matched_road_name": record.get("matched_road_name", ""),
                "target_road_names": record.get("target_road_names", ""),
                "velocity_kmph": current,
                "free_flow_kmph": free,
                "current_travel_time": _as_float(segment.get("currentTravelTime")),
                "free_flow_travel_time": _as_float(segment.get("freeFlowTravelTime")),
                "confidence": max(0.0, min(1.0, confidence)),
                "recency_score": recency,
                "source_quality": source_quality,
                "congestion_ratio": ratio,
                "density_proxy": density_proxy,
                "los": los_from_velocity(current),
                "congestion_level": congestion_level(ratio, road_closed, current),
                "road_closure": road_closed,
                "source_name": source_name,
                "source_api": record.get("source_api", ""),
                "raw_path": record.get("raw_path", ""),
                "extract_error": record.get("extract_error", ""),
                "extracted_at": record["extracted_at"],
            }
        )
    return pd.DataFrame(rows)


def fuse_by_node(observations: pd.DataFrame, etl: EtlConfig) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    cfg = etl.fusion
    for node_id, group in observations.groupby("node_id", dropna=False):
        valid = group.dropna(subset=["velocity_kmph", "congestion_ratio"]).copy()
        if valid.empty:
            rows.append(
                {
                    "node_id": node_id,
                    "node_name": group["node_name"].iloc[0] if not group.empty else "",
                    "status": "insufficient_data",
                    "fused_velocity": None,
                    "fused_congestion_ratio": None,
                    "los": "unknown",
                    "congestion_level": "unknown",
                    "confidence": 0.0,
                    "observation_count": 0,
                    "weight_sum": 0.0,
                }
            )
            continue
        raw_weight = (
            cfg.alpha_confidence * valid["confidence"].astype(float)
            + cfg.beta_recency * valid["recency_score"].astype(float)
            + cfg.gamma_source_quality * valid["source_quality"].astype(float)
        )
        weight_sum = float(raw_weight.sum())
        valid["normalized_weight"] = raw_weight / weight_sum if weight_sum else 1 / len(valid)
        fused_velocity = float((valid["velocity_kmph"] * valid["normalized_weight"]).sum())
        fused_ratio = float((valid["congestion_ratio"] * valid["normalized_weight"]).sum())
        fused_confidence = float((valid["confidence"] * valid["normalized_weight"]).sum())
        rows.append(
            {
                "node_id": node_id,
                "node_name": valid["node_name"].iloc[0],
                "status": "ok",
                "fused_velocity": round(fused_velocity, 4),
                "fused_congestion_ratio": round(fused_ratio, 4),
                "los": los_from_velocity(fused_velocity),
                "congestion_level": congestion_level(
                    fused_ratio,
                    bool(valid["road_closure"].any()),
                    fused_velocity,
                ),
                "confidence": round(fused_confidence, 4),
                "observation_count": int(len(valid)),
                "weight_sum": round(float(valid["normalized_weight"].sum()), 6),
            }
        )
    return pd.DataFrame(rows)


def transform_osm_edges(records: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(records)


def _as_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
