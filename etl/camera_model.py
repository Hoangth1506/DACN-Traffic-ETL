"""
camera_model.py — Layer 1 (Edge): Transform TomTom record → CameraRecord schema.

Mỗi TomTom sample point (sample_id 0-8) = 1 "camera" trên tuyến đường.
9 cameras/node × 3 nodes = 27 cameras/session.

CameraRecord schema (theo hướng dẫn Node-Agent-Edge, điều chỉnh cho JSON data):
  timestamp, node_id, camera_id, road_segment,
  lat, lon, velocity, free_flow_velocity, density,
  image_quality (= TomTom confidence), reliability,
  los, road_closure, frc, osm_matched, segment_length_km
"""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

# FRC → reliability weight (đường lớn → đo tin cậy hơn vì ít obstruction)
FRC_RELIABILITY: dict[str, float] = {
    "FRC0": 0.98, "FRC1": 0.95, "FRC2": 0.92,
    "FRC3": 0.88, "FRC4": 0.84, "FRC5": 0.80,
    "FRC6": 0.75, "FRC7": 0.70,
}

# Node short name mapping
NODE_SHORT = {
    "N01_LY_THUONG_KIET": "N01",
    "N02_CONG_HOA":       "N02",
    "N03_TRUONG_CHINH":   "N03",
}


def build_camera_records(unified_df: pd.DataFrame) -> pd.DataFrame:
    """
    Chuyển unified DataFrame (từ T4) → camera_records DataFrame (Layer 1).

    Mỗi row = 1 CameraRecord:
      - camera_id = "{node_short}_C{sample_id:02d}"
      - image_quality = confidence (thay thế camera image quality)
      - reliability = confidence × frc_weight (ước tính độ tin cậy điểm đo)

    Args:
        unified_df: DataFrame từ generate_data pipeline (sau T4)

    Returns:
        pd.DataFrame với các cột đã chuẩn hóa.
    """
    df = unified_df.copy()

    # 1. Sắp xếp để đảm bảo đúng thứ tự không gian tuyến đường (00 đến 08)
    df = df.sort_values(["session_id", "node_id", "sample_id"])

    # 2. Làm mượt vận tốc (current_speed) bằng trung bình trượt không gian 3 điểm
    df["current_speed"] = df.groupby(["session_id", "node_id"])["current_speed"].transform(
        lambda x: x.rolling(window=3, center=True, min_periods=1).mean()
    )

    # 3. Kết hợp co hẹp đồng thuận (Consensus Shrinkage) về vận tốc trung vị của Nút giao (Hybrid method)
    medians = df.groupby(["session_id", "node_id"])["current_speed"].transform("median")
    df["current_speed"] = 0.8 * df["current_speed"] + 0.2 * medians

    # 4. Tính toán lại các chỉ số phụ thuộc để đảm bảo tính nhất quán dữ liệu:
    # - congestion_index: (free_flow - speed) / free_flow (Mật độ)
    # - speed_ratio: speed / free_flow (Tỷ lệ tốc độ)
    df["congestion_index"] = ((df["free_flow_speed"] - df["current_speed"]) / df["free_flow_speed"]).clip(0.0, 1.0).round(4)
    df["speed_ratio"] = (df["current_speed"] / df["free_flow_speed"]).round(4)

    # 5. Phân loại lại LOS và trạng thái ùn tắc từ vận tốc đã làm mượt
    def _los_from_speed(speed: float | None) -> str:
        if speed is None or pd.isna(speed):
            return "unknown"
        if speed < 7:   return "A"
        if speed < 13:  return "B"
        if speed < 20:  return "C"
        if speed < 30:  return "D"
        if speed < 35:  return "E"
        return "F"

    df["los"] = df["current_speed"].apply(_los_from_speed)
    df["is_congested"] = df["los"].isin(["A", "B", "C"])

    # Node short code (N01, N02, N03)
    df["node_short"] = df["node_id"].map(NODE_SHORT).fillna(df["node_id"].str[:3])

    # Camera ID: N01_C00, N01_C01, ..., N01_C08
    df["camera_id"] = df["node_short"] + "_C" + df["sample_id"].fillna(0).astype(int).astype(str).str.zfill(2)

    # image_quality = TomTom confidence (thay thế camera image quality metric)
    df["image_quality"] = df["confidence"].clip(0.0, 1.0)

    # reliability = confidence × FRC weight
    frc_weight = df["frc"].map(FRC_RELIABILITY).fillna(0.85)
    df["reliability"] = (df["confidence"] * frc_weight).round(4).clip(0.0, 1.0)

    # road_segment = matched_road_name (tên tuyến đường)
    df["road_segment"] = df["matched_road_name"].fillna(
        df["node_id"].str.replace("_", " ").str.title()
    )

    # Chọn và đổi tên columns
    keep = {
        "extracted_at":         "timestamp",
        "session_id":           "session_id",
        "node_id":              "node_id",
        "node_short":           "node_short",
        "camera_id":            "camera_id",
        "road_segment":         "road_segment",
        "sample_lat":           "lat",
        "sample_lon":           "lon",
        "centroid_lat":         "centroid_lat",
        "centroid_lon":         "centroid_lon",
        "current_speed":        "velocity",
        "free_flow_speed":      "free_flow_velocity",
        "congestion_index":     "density",
        "image_quality":        "image_quality",
        "reliability":          "reliability",
        "los":                  "los",
        "is_congested":         "is_congested",
        "road_closure":         "road_closure",
        "frc":                  "frc",
        "road_class_label":     "road_class_label",
        "osm_matched":          "osm_matched",
        "osm_name":             "osm_name",
        "segment_length_km":    "segment_length_km",
        "time_slot":            "time_slot",
        "date_str":             "date_str",
        "hour_vn":              "hour_vn",
        "delay_index":          "delay_index",
        "speed_ratio":          "speed_ratio",
    }

    available = {k: v for k, v in keep.items() if k in df.columns}
    result = df[list(available.keys())].rename(columns=available)

    logger.info(
        "camera_model: %d CameraRecords từ %d sessions × %d nodes",
        len(result),
        result["session_id"].nunique() if "session_id" in result.columns else 0,
        result["node_id"].nunique(),
    )
    return result


def camera_records_summary(cam_df: pd.DataFrame) -> dict[str, Any]:
    """Tóm tắt thống kê camera records."""
    return {
        "total_records":    int(len(cam_df)),
        "unique_cameras":   int(cam_df["camera_id"].nunique()) if "camera_id" in cam_df.columns else 0,
        "unique_sessions":  int(cam_df["session_id"].nunique()) if "session_id" in cam_df.columns else 0,
        "avg_image_quality": round(float(cam_df["image_quality"].mean()), 4) if "image_quality" in cam_df.columns else None,
        "avg_reliability":  round(float(cam_df["reliability"].mean()), 4) if "reliability" in cam_df.columns else None,
        "cameras_per_node": {
            nid: int(g["camera_id"].nunique())
            for nid, g in cam_df.groupby("node_id")
        } if "node_id" in cam_df.columns else {},
    }
