"""
performance_eval.py — Layer 3 (Central): 4 nhóm chỉ số đánh giá hiệu năng hệ thống.

Nhóm 1: Độ chính xác hợp nhất (fusion accuracy)
Nhóm 2: Hiệu năng thu thập dữ liệu (collection performance)
Nhóm 3: Hiệu quả dữ liệu (data efficiency)
Nhóm 4: Độ bền hệ thống (robustness simulation)
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Tham số hệ thống
API_LATENCY_MS   = 140   # ms/camera
CAMERA_PER_NODE  = 9     # cameras per node
N_NODES          = 3     # số nodes
QUALITY_THRESHOLD_NORMAL    = 0.50
QUALITY_THRESHOLD_DEGRADED  = 0.30


def compute_performance_metrics(
    cam_df: pd.DataFrame,
    ns_df:  pd.DataFrame,
) -> dict[str, Any]:
    """
    Tính toán 4 nhóm chỉ số đánh giá hiệu năng hệ thống.

    Args:
        cam_df: CameraRecords DataFrame (Layer 1)
        ns_df:  NodeStates DataFrame (Layer 2)

    Returns:
        dict chứa 4 nhóm metrics.
    """
    metrics: dict[str, Any] = {}

    metrics["group1_fusion_accuracy"]       = _group1_fusion_accuracy(cam_df, ns_df)
    metrics["group2_collection_performance"] = _group2_collection_performance(cam_df, ns_df)
    metrics["group3_data_efficiency"]        = _group3_data_efficiency(cam_df, ns_df)
    metrics["group4_robustness"]             = _group4_robustness(cam_df, ns_df)

    logger.info("performance_eval: 4 nhom chi so da tinh xong")
    return metrics


# ─────────────────────────────────────────────────────────────────────────────
# Nhóm 1 — Độ chính xác hợp nhất
# ─────────────────────────────────────────────────────────────────────────────

def _group1_fusion_accuracy(cam_df: pd.DataFrame, ns_df: pd.DataFrame) -> dict[str, Any]:
    """
    Đánh giá độ chính xác của quá trình fusion tại layer 2.

    Metrics:
      - fusion_velocity_consistency: std(fused_velocity) thấp → fusion ổn định
      - camera_agreement_rate: % cameras trong node đồng thuận với node state
      - confidence_avg: trung bình confidence across all node states
      - congestion_detection_rate: % sessions mà fused LOS = majority LOS của cameras
    """
    g: dict[str, Any] = {}

    if ns_df.empty or cam_df.empty:
        return {"error": "Khong du du lieu"}

    # Fusion velocity consistency per node
    if "fused_velocity" in ns_df.columns and "node_id" in ns_df.columns:
        per_node = ns_df.groupby("node_id")["fused_velocity"].agg(["mean", "std"]).round(3)
        g["fused_velocity_per_node"] = per_node.to_dict("index")
        g["overall_velocity_mean"]   = round(float(ns_df["fused_velocity"].mean()), 2)
        g["overall_velocity_std"]    = round(float(ns_df["fused_velocity"].std()), 2)

    # Camera agreement rate (đã tính trong node_agent)
    if "camera_agreement_rate" in ns_df.columns:
        g["camera_agreement_rate_avg"] = round(float(ns_df["camera_agreement_rate"].mean()), 4)
        g["camera_agreement_per_node"] = (
            ns_df.groupby("node_id")["camera_agreement_rate"].mean().round(4).to_dict()
        )

    # Average confidence
    if "confidence" in ns_df.columns:
        g["confidence_avg"] = round(float(ns_df["confidence"].mean()), 4)
        g["confidence_per_node"] = (
            ns_df.groupby("node_id")["confidence"].mean().round(4).to_dict()
        )

    # Congestion detection consistency: so sánh fused LOS với mode LOS của cameras trong session
    if all(c in cam_df.columns for c in ["session_id", "node_id", "los"]) and \
       all(c in ns_df.columns for c in ["session_id", "node_id", "los"]):
        cam_mode = cam_df.groupby(["session_id", "node_id"])["los"].agg(
            lambda x: x.mode().iloc[0] if len(x) > 0 else "unknown"
        ).reset_index(name="camera_mode_los")

        merged = ns_df[["session_id", "node_id", "los"]].merge(
            cam_mode, on=["session_id", "node_id"], how="inner"
        )
        if not merged.empty:
            match_rate = (merged["los"] == merged["camera_mode_los"]).mean()
            g["congestion_detection_rate"] = round(float(match_rate), 4)
        else:
            g["congestion_detection_rate"] = None

    # Intra-session velocity spread per node (đo variance giữa cameras trong cùng session)
    if all(c in cam_df.columns for c in ["session_id", "node_id", "velocity"]):
        intra_spread = cam_df.groupby(["session_id", "node_id"])["velocity"].std().mean()
        g["intra_session_velocity_spread_avg"] = round(float(intra_spread), 2) if not math.isnan(intra_spread) else None

    # Calculate fusion MAE and MAPE vs camera records (ground truth proxy)
    if "fused_velocity" in ns_df.columns and not cam_df.empty:
        merged_df = cam_df.merge(
            ns_df[["session_id", "node_id", "fused_velocity"]],
            on=["session_id", "node_id"],
            how="inner"
        )
        if not merged_df.empty:
            merged_df["velocity"] = pd.to_numeric(merged_df["velocity"], errors="coerce")
            valid_df = merged_df[merged_df["velocity"] > 0].copy()
            if not valid_df.empty:
                abs_err = (valid_df["velocity"] - valid_df["fused_velocity"]).abs()
                mape_err = (abs_err / valid_df["velocity"]) * 100
                g["fusion_mae"]  = round(float(abs_err.mean()), 3)
                g["fusion_mape"] = round(float(mape_err.mean()), 3)

    return g


# ─────────────────────────────────────────────────────────────────────────────
# Nhóm 2 — Hiệu năng thu thập dữ liệu
# ─────────────────────────────────────────────────────────────────────────────

def _group2_collection_performance(cam_df: pd.DataFrame, ns_df: pd.DataFrame) -> dict[str, Any]:
    """
    Đánh giá hiệu năng thu thập và xử lý dữ liệu.

    Metrics:
      - sessions_per_day: số session thu thập / ngày
      - collection_interval_avg_min: khoảng cách TB giữa 2 sessions (phút)
      - api_latency_per_node_ms: ước tính thời gian thu thập 1 node
      - data_freshness_score: % records trong khung giờ thu thập hợp lệ
    """
    g: dict[str, Any] = {}

    # Sessions per day
    if "date_str" in cam_df.columns and "session_id" in cam_df.columns:
        spd = cam_df.groupby("date_str")["session_id"].nunique()
        g["sessions_per_day_avg"] = round(float(spd.mean()), 1)
        g["sessions_per_day_min"] = int(spd.min())
        g["sessions_per_day_max"] = int(spd.max())
        g["total_days"]           = int(spd.count())
        g["total_sessions"]       = int(cam_df["session_id"].nunique())

    # Active cameras ratio per session
    if "active_cameras" in ns_df.columns and "total_cameras" in ns_df.columns:
        ns_df["cam_avail"] = ns_df["active_cameras"] / ns_df["total_cameras"].replace(0, 1)
        g["camera_availability_avg"]  = round(float(ns_df["cam_avail"].mean()), 4)
        g["camera_availability_per_node"] = (
            ns_df.groupby("node_id")["cam_avail"].mean().round(4).to_dict()
        )

    # Latency estimates
    avg_active = float(ns_df["active_cameras"].mean()) if "active_cameras" in ns_df.columns else CAMERA_PER_NODE
    g["api_latency_per_camera_ms"]   = API_LATENCY_MS
    g["api_latency_per_node_ms"]     = round(avg_active * API_LATENCY_MS, 0)
    g["api_latency_all_nodes_ms"]    = round(avg_active * API_LATENCY_MS * N_NODES, 0)
    g["alert_response_estimate_ms"]  = round(avg_active * API_LATENCY_MS + 300, 0)  # +300ms network

    # Data freshness (giờ thu thập trong window hợp lệ)
    if "time_slot" in cam_df.columns:
        valid_slots = {"morning_peak", "midday_peak", "evening_peak"}
        freshness = cam_df["time_slot"].isin(valid_slots).mean()
        g["data_freshness_score"] = round(float(freshness), 4)

    # Average image quality
    if "image_quality" in cam_df.columns:
        g["avg_image_quality"] = round(float(cam_df["image_quality"].mean()), 4)
        g["pct_high_quality"]  = round(float((cam_df["image_quality"] >= QUALITY_THRESHOLD_NORMAL).mean()), 4)

    return g


# ─────────────────────────────────────────────────────────────────────────────
# Nhóm 3 — Hiệu quả dữ liệu
# ─────────────────────────────────────────────────────────────────────────────

def _group3_data_efficiency(cam_df: pd.DataFrame, ns_df: pd.DataFrame) -> dict[str, Any]:
    """
    Đánh giá hiệu quả truyền thông và nén dữ liệu.

    Metrics:
      - camera_record_size_bytes: kích thước 1 CameraRecord
      - node_state_size_bytes: kích thước 1 NodeState
      - compression_ratio: số lần giảm so với gửi raw cameras
      - bandwidth_reduction_pct
      - daily_bandwidth estimations
    """
    g: dict[str, Any] = {}

    # Ước tính kích thước record
    if not cam_df.empty:
        sample_cam = cam_df.iloc[0].dropna().to_dict()
        cam_size   = len(json.dumps({str(k): str(v) for k,v in sample_cam.items()}).encode())
        g["camera_record_size_bytes"] = cam_size
    else:
        cam_size = 600
        g["camera_record_size_bytes"] = cam_size

    if not ns_df.empty:
        sample_ns  = ns_df.iloc[0].dropna().to_dict()
        # loại camera_positions vì nó là list lớn
        sample_ns.pop("camera_positions", None)
        ns_size    = len(json.dumps({str(k): str(v) for k,v in sample_ns.items()}).encode())
        g["node_state_size_bytes"] = ns_size
    else:
        ns_size = 400
        g["node_state_size_bytes"] = ns_size

    raw_per_session   = cam_size * CAMERA_PER_NODE * N_NODES
    fused_per_session = ns_size * N_NODES
    compression_ratio = raw_per_session / fused_per_session if fused_per_session > 0 else 1.0

    g["raw_data_per_session_bytes"]    = raw_per_session
    g["fused_data_per_session_bytes"]  = fused_per_session
    g["compression_ratio"]             = round(compression_ratio, 2)
    g["bandwidth_reduction_pct"]       = round((1 - 1/compression_ratio) * 100, 1) if compression_ratio > 1 else 0.0

    # Daily bandwidth estimate
    sessions_per_day = g.get("sessions_per_day_avg", 8)  # fallback
    if "total_sessions" in _group2_collection_performance(cam_df, ns_df):
        pass  # already computed
    sessions_per_day_val = float(cam_df.groupby("date_str")["session_id"].nunique().mean()) if "date_str" in cam_df.columns else 8.0

    g["daily_raw_bandwidth_kb"]   = round(raw_per_session * sessions_per_day_val / 1024, 1)
    g["daily_fused_bandwidth_kb"] = round(fused_per_session * sessions_per_day_val / 1024, 1)
    g["cameras_per_node"]          = CAMERA_PER_NODE
    g["nodes"]                     = N_NODES
    g["records_per_session"]       = CAMERA_PER_NODE * N_NODES

    return g


# ─────────────────────────────────────────────────────────────────────────────
# Nhóm 4 — Độ bền hệ thống (Robustness Simulation)
# ─────────────────────────────────────────────────────────────────────────────

def _group4_robustness(cam_df: pd.DataFrame, ns_df: pd.DataFrame) -> dict[str, Any]:
    """
    Mô phỏng 3 kịch bản lỗi để đánh giá độ bền.

    Scenario A: Camera dropout — xóa 1 camera khỏi node → tính lại velocity
    Scenario B: Quality degradation — hạ threshold → xem confidence thay đổi
    Scenario C: Node failure — xóa 1 node → coverage giảm
    """
    g: dict[str, Any] = {}

    # ── Scenario A: Camera dropout ────────────────────────────────────────────
    if all(c in cam_df.columns for c in ["session_id", "node_id", "camera_id", "velocity", "image_quality", "reliability"]):
        dropout_deltas: list[float] = []

        for (sid, nid), grp in cam_df.groupby(["session_id", "node_id"]):
            if len(grp) < 2:
                continue

            # Velocity với full cameras
            w_full = (grp["image_quality"] * grp["reliability"]).values
            v_full = pd.to_numeric(grp["velocity"], errors="coerce").values
            mask   = ~np.isnan(v_full)
            if not mask.any() or w_full[mask].sum() == 0:
                continue
            vel_full = float(np.dot(w_full[mask], v_full[mask]) / w_full[mask].sum())

            # Velocity với -1 camera (loại camera có weight thấp nhất)
            drop_idx = w_full.argmin()
            grp_drop = grp.drop(grp.index[drop_idx])
            w_drop   = (grp_drop["image_quality"] * grp_drop["reliability"]).values
            v_drop   = pd.to_numeric(grp_drop["velocity"], errors="coerce").values
            mask_d   = ~np.isnan(v_drop)
            if not mask_d.any() or w_drop[mask_d].sum() == 0:
                continue
            vel_drop = float(np.dot(w_drop[mask_d], v_drop[mask_d]) / w_drop[mask_d].sum())

            delta = abs(vel_full - vel_drop)
            if vel_full > 0:
                dropout_deltas.append(delta / vel_full)

        g["scenario_a_camera_dropout"] = {
            "description":   "Xoa 1 camera yeu nhat khoi node, tinh lai fused_velocity",
            "avg_velocity_delta_pct": round(float(np.mean(dropout_deltas)) * 100, 2) if dropout_deltas else 0.0,
            "max_velocity_delta_pct": round(float(np.max(dropout_deltas)) * 100, 2) if dropout_deltas else 0.0,
            "resilience_score":       round(1.0 - float(np.mean(dropout_deltas)), 4) if dropout_deltas else 1.0,
            "n_simulations":          len(dropout_deltas),
        }
    else:
        g["scenario_a_camera_dropout"] = {"description": "Khong du columns de simulate"}

    # ── Scenario B: Quality threshold degradation ─────────────────────────────
    if all(c in ns_df.columns for c in ["confidence", "active_cameras", "total_cameras"]):
        # Normal: threshold = 0.5
        conf_normal = float(ns_df["confidence"].mean())
        avail_normal = float((ns_df["active_cameras"] / ns_df["total_cameras"].replace(0, 1)).mean())

        # Degraded: simulate lower quality (threshold = 0.3, more cameras included but lower quality)
        # → Confidence drops as low-quality cameras are included
        if "image_quality" in cam_df.columns:
            low_q_ratio = float((cam_df["image_quality"] < QUALITY_THRESHOLD_NORMAL).mean())
            conf_degraded = conf_normal * (1 - low_q_ratio * 0.3)  # ước tính
            avail_degraded = min(1.0, avail_normal + low_q_ratio * 0.8)
        else:
            conf_degraded = conf_normal * 0.85
            avail_degraded = 1.0

        g["scenario_b_quality_degradation"] = {
            "description":       "Giam nguong image_quality tu 0.5 xuong 0.3 (anh mo/nhieu)",
            "confidence_normal":   round(conf_normal, 4),
            "confidence_degraded": round(conf_degraded, 4),
            "confidence_drop_pct": round((1 - conf_degraded / conf_normal) * 100, 1) if conf_normal > 0 else 0.0,
            "availability_normal":   round(avail_normal, 4),
            "availability_degraded": round(avail_degraded, 4),
            "resilience_score":    round(conf_degraded / conf_normal, 4) if conf_normal > 0 else 1.0,
        }

    # ── Scenario C: Node failure ──────────────────────────────────────────────
    if "node_id" in ns_df.columns:
        nodes = ns_df["node_id"].unique().tolist()
        coverage_full = 1.0
        coverage_per_failure = {}

        for failed_node in nodes:
            remaining = [n for n in nodes if n != failed_node]
            coverage_remaining = len(remaining) / len(nodes)

            # Speed estimation impact: std của remaining nodes vs all nodes
            if "fused_velocity" in ns_df.columns:
                v_all = float(ns_df["fused_velocity"].mean())
                v_rem = float(ns_df[ns_df["node_id"].isin(remaining)]["fused_velocity"].mean())
                speed_impact = abs(v_all - v_rem) / v_all if v_all > 0 else 0.0
            else:
                speed_impact = 0.0

            coverage_per_failure[failed_node] = {
                "remaining_nodes": remaining,
                "coverage_pct":    round(coverage_remaining * 100, 1),
                "speed_impact_pct": round(speed_impact * 100, 2),
                "resilience_score": round(coverage_remaining * (1 - speed_impact), 4),
            }

        g["scenario_c_node_failure"] = {
            "description":       "Gia su 1 trong 3 nodes bi loi",
            "full_coverage_pct": 100.0,
            "per_node_failure":  coverage_per_failure,
            "avg_coverage_when_1_fails": round(((N_NODES - 1) / N_NODES) * 100, 1),
        }

    return g


def print_performance_summary(metrics: dict[str, Any]) -> None:
    """In summary 4 nhom chi so ra console (ASCII safe)."""
    print("\n" + "=" * 60)
    print("  PERFORMANCE EVALUATION — Node-Agent-Edge System")
    print("=" * 60)

    g1 = metrics.get("group1_fusion_accuracy", {})
    print("\n[Nhom 1] Do chinh xac hop nhat (Fusion Accuracy):")
    print(f"  Velocity trung binh  : {g1.get('overall_velocity_mean', 'N/A')} km/h")
    print(f"  Velocity std         : {g1.get('overall_velocity_std', 'N/A')} km/h")
    print(f"  Segment agreement rate: {g1.get('camera_agreement_rate_avg', 'N/A')}")
    print(f"  Confidence trung binh: {g1.get('confidence_avg', 'N/A')}")
    print(f"  Congestion detect rate: {g1.get('congestion_detection_rate', 'N/A')}")
    print(f"  Fusion MAE (Sai so MAE): {g1.get('fusion_mae', 'N/A')} km/h")
    print(f"  Fusion MAPE (Sai so MAPE): {g1.get('fusion_mape', 'N/A')}%")

    g2 = metrics.get("group2_collection_performance", {})
    print("\n[Nhom 2] Hieu nang thu thap:")
    print(f"  Sessions/ngay        : {g2.get('sessions_per_day_avg', 'N/A')}")
    print(f"  Latency/node (ms)    : {g2.get('api_latency_per_node_ms', 'N/A')}")
    print(f"  Alert response (ms)  : {g2.get('alert_response_estimate_ms', 'N/A')}")
    print(f"  Data freshness       : {g2.get('data_freshness_score', 'N/A')}")

    g3 = metrics.get("group3_data_efficiency", {})
    print("\n[Nhom 3] Hieu qua du lieu:")
    print(f"  Compression ratio    : {g3.get('compression_ratio', 'N/A')}x")
    print(f"  Bandwidth reduction  : {g3.get('bandwidth_reduction_pct', 'N/A')}%")
    print(f"  Daily fused BW (KB)  : {g3.get('daily_fused_bandwidth_kb', 'N/A')}")

    g4 = metrics.get("group4_robustness", {})
    print("\n[Nhom 4] Do ben he thong:")
    sc_a = g4.get("scenario_a_camera_dropout", {})
    print(f"  A) Segment dropout: velocity delta avg = {sc_a.get('avg_velocity_delta_pct', 'N/A')}%")
    sc_b = g4.get("scenario_b_quality_degradation", {})
    print(f"  B) Data degrade: confidence drop = {sc_b.get('confidence_drop_pct', 'N/A')}%")
    sc_c = g4.get("scenario_c_node_failure", {})
    print(f"  C) Node failure  : coverage = {sc_c.get('avg_coverage_when_1_fails', 'N/A')}%")
    print("=" * 60)
