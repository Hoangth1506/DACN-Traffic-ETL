"""
node_agent.py — Layer 2 (Agent): Confidence-weighted fusion từ CameraRecords → NodeState.

Mỗi NodeAgent xử lý 9 CameraRecords (9 điểm đo dọc tuyến) trong 1 session
và trả về 1 NodeState đại diện cho trạng thái giao thông của node đó.

Algorithm:
  1. Filter: loại cameras có image_quality < QUALITY_THRESHOLD
  2. Weight: w_i = image_quality_i × reliability_i
  3. Fused velocity  = Σ(w_i × v_i) / Σw_i
  4. Fused density   = Σ(w_i × d_i) / Σw_i
  5. Confidence      = mean(reliability_i of active cameras)
  6. Congestion level: from fused LOS
  7. Latency (ms)    = active_cameras × API_LATENCY_MS
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Ngưỡng chất lượng tối thiểu để camera được tính vào fusion
QUALITY_THRESHOLD = 0.50

# Ước tính latency mỗi API call (ms) — TomTom API thực tế ~100-200ms
API_LATENCY_MS = 140

# Mapping LOS → congestion_level
LOS_TO_CONGESTION: dict[str, str] = {
    "A": "critical", "B": "high",
    "C": "medium",   "D": "medium",
    "E": "low",      "F": "low",
    "unknown": "unknown",
}


def run_node_agents(cam_df: pd.DataFrame) -> pd.DataFrame:
    """
    Chạy NodeAgent cho tất cả (session_id, node_id) pairs.

    Args:
        cam_df: DataFrame từ camera_model.build_camera_records()

    Returns:
        pd.DataFrame — mỗi row = 1 NodeState (1 session × 1 node).
    """
    if cam_df.empty:
        logger.warning("node_agent: cam_df rỗng")
        return pd.DataFrame()

    group_keys = ["session_id", "node_id"]
    available_keys = [k for k in group_keys if k in cam_df.columns]

    rows: list[dict[str, Any]] = []
    for keys, group in cam_df.groupby(available_keys):
        session_id = keys[0] if isinstance(keys, tuple) else keys
        node_id = keys[1] if isinstance(keys, tuple) and len(keys) > 1 else group["node_id"].iloc[0]

        state = _fuse_node(group, session_id=session_id, node_id=node_id)
        rows.append(state)

    result = pd.DataFrame(rows)
    logger.info(
        "node_agent: %d NodeStates (%d sessions × %d nodes)",
        len(result),
        result["session_id"].nunique() if "session_id" in result.columns else 0,
        result["node_id"].nunique() if "node_id" in result.columns else 0,
    )
    return result


def _fuse_node(
    cameras: pd.DataFrame,
    session_id: str,
    node_id: str,
) -> dict[str, Any]:
    """
    Thực hiện confidence-weighted fusion cho 1 node trong 1 session.

    Args:
        cameras:    Subset of cam_df cho (session_id, node_id)
        session_id: Session identifier
        node_id:    Node identifier

    Returns:
        dict — NodeState record
    """
    total_cameras = len(cameras)

    # ── Filter: chỉ giữ cameras đủ chất lượng ────────────────────────────────
    active = cameras[cameras["image_quality"] >= QUALITY_THRESHOLD].copy()
    active_count = len(active)

    if active_count == 0:
        logger.warning("node_agent: node %s session %s — tất cả cameras bị loại (quality < %.2f)",
                       node_id, session_id, QUALITY_THRESHOLD)
        active = cameras.copy()  # fallback: dùng tất cả
        active_count = len(active)

    # ── Tính trọng số có hiệu chỉnh đồng thuận (Consensus Penalty) ────────────────
    iq = active["image_quality"].fillna(0.5).values
    rl_series = active["reliability"].fillna(0.85) if "reliability" in active.columns else pd.Series([0.85] * len(active))
    rl = rl_series.values

    # Tính vận tốc trung vị để phạt các camera đo lệch pha (Outlier Penalty)
    v_vals = pd.to_numeric(active["velocity"], errors="coerce").fillna(25.0).values
    median_v = np.median(v_vals)
    devs = np.abs(v_vals - median_v)
    
    # Hệ số phạt: e^(-0.04 * độ lệch vận tốc)
    penalty = np.exp(-0.04 * devs)
    
    # Trọng số hợp nhất động
    weights = iq * rl * penalty
    w_sum = weights.sum()

    if w_sum <= 0:
        weights = np.ones(len(active))
        w_sum = float(len(active))

    def wavg(col: str) -> float | None:
        if col not in active.columns:
            return None
        vals = pd.to_numeric(active[col], errors="coerce").values
        mask = ~np.isnan(vals)
        if not mask.any():
            return None
        w = weights[mask]
        return float(np.dot(w, vals[mask]) / w.sum())

    # ── Fusion calculations ───────────────────────────────────────────────────
    fused_velocity = wavg("velocity")
    fused_density  = wavg("density")
    fused_delay    = wavg("delay_index")
    fused_speed_ratio = wavg("speed_ratio")
    
    # Độ tự tin tổng hợp của node: trung bình có trọng số phạt (xung đột cao -> confidence giảm)
    confidence = float(np.mean(rl * penalty)) if active_count > 0 else 0.5

    # LOS từ fused velocity
    fused_los = _los_from_speed(fused_velocity)
    congestion_level = LOS_TO_CONGESTION.get(fused_los, "unknown")

    # Latency ước tính
    latency_ms = active_count * API_LATENCY_MS

    # Camera positions (cho vẽ polyline trên map)
    lat_col = "lat" if "lat" in active.columns else None
    lon_col = "lon" if "lon" in active.columns else None
    positions: list[list[float]] = []
    if lat_col and lon_col:
        pos_df = active[[lat_col, lon_col]].dropna()
        positions = pos_df.values.tolist()

    # Centroid của node
    node_lat = float(active[lat_col].mean()) if lat_col and len(active) > 0 else None
    node_lon = float(active[lon_col].mean()) if lon_col and len(active) > 0 else None

    # Metadata từ group
    road_segment = active["road_segment"].mode().iloc[0] if "road_segment" in active.columns and len(active) > 0 else ""
    time_slot    = active["time_slot"].mode().iloc[0] if "time_slot" in active.columns and len(active) > 0 else ""
    date_str     = active["date_str"].mode().iloc[0] if "date_str" in active.columns and len(active) > 0 else ""
    hour_vn      = int(active["hour_vn"].mode().iloc[0]) if "hour_vn" in active.columns and len(active) > 0 else None
    timestamp    = active["timestamp"].iloc[0] if "timestamp" in active.columns and len(active) > 0 else ""

    # Camera-level agreement: % cameras đồng thuận với fused congestion level
    cam_levels = active.apply(
        lambda r: LOS_TO_CONGESTION.get(r.get("los", "unknown"), "unknown"), axis=1
    )
    agreement_rate = float((cam_levels == congestion_level).mean()) if len(cam_levels) > 0 else 1.0

    return {
        "timestamp":            str(timestamp),
        "session_id":           session_id,
        "node_id":              node_id,
        "node_short":           active["node_short"].iloc[0] if "node_short" in active.columns else node_id[:3],
        "road_segment":         road_segment,
        "date_str":             str(date_str),
        "hour_vn":              hour_vn,
        "time_slot":            time_slot,

        # Fused traffic state
        "fused_velocity":       round(fused_velocity, 2) if fused_velocity is not None else None,
        "fused_density":        round(fused_density, 4) if fused_density is not None else None,
        "fused_delay_index":    round(fused_delay, 4) if fused_delay is not None else None,
        "fused_speed_ratio":    round(fused_speed_ratio, 4) if fused_speed_ratio is not None else None,
        "los":                  fused_los,
        "congestion_level":     congestion_level,
        "is_congested":         fused_los in ("A", "B", "C"),

        # Agent metadata
        "confidence":           round(confidence, 4),
        "active_cameras":       active_count,
        "total_cameras":        total_cameras,
        "camera_availability":  round(active_count / total_cameras, 4) if total_cameras > 0 else 0,
        "camera_agreement_rate": round(agreement_rate, 4),
        "latency_ms":           latency_ms,
        "quality_threshold":    QUALITY_THRESHOLD,

        # Position info
        "node_lat":             round(node_lat, 7) if node_lat is not None else None,
        "node_lon":             round(node_lon, 7) if node_lon is not None else None,
        "camera_positions":     positions,   # list of [lat, lon]
    }


def node_states_summary(ns_df: pd.DataFrame) -> dict[str, Any]:
    """Tóm tắt thống kê node states."""
    if ns_df.empty:
        return {}
    return {
        "total_node_states":    int(len(ns_df)),
        "sessions":             int(ns_df["session_id"].nunique()) if "session_id" in ns_df.columns else 0,
        "per_node": {
            nid: {
                "avg_fused_velocity": round(float(g["fused_velocity"].mean()), 2),
                "avg_confidence":     round(float(g["confidence"].mean()), 4),
                "avg_active_cameras": round(float(g["active_cameras"].mean()), 1),
                "avg_latency_ms":     round(float(g["latency_ms"].mean()), 0),
                "pct_congested":      round(float(g["is_congested"].mean() * 100), 1),
                "congestion_levels":  g["congestion_level"].value_counts().to_dict(),
            }
            for nid, g in ns_df.groupby("node_id")
        },
    }


def _los_from_speed(speed: float | None) -> str:
    """Level of Service từ tốc độ (km/h)."""
    if speed is None or (isinstance(speed, float) and np.isnan(speed)):
        return "unknown"
    if speed < 7:   return "A"
    if speed < 13:  return "B"
    if speed < 20:  return "C"
    if speed < 30:  return "D"
    if speed < 35:  return "E"
    return "F"
