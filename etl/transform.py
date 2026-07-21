"""
transform.py — T1-T4 transformations cho dữ liệu TomTom và OSM.

T1 - Normalize TomTom:
    - Parse timestamp timezone-aware (Asia/Ho_Chi_Minh)
    - Tính congestion_index, LOS, segment_length_km
    - Map FRC → road_class_label
    - Extract polyline centroid

T2 - Normalize OSM:
    - Map highway → FRC equivalent
    - Parse lanes, oneway, maxspeed

T4 - Feature Engineering:
    - time_slot, is_congested, speed_ratio, delay_index
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

TZ_VN = ZoneInfo("Asia/Ho_Chi_Minh")

# ── FRC mapping ──────────────────────────────────────────────────────────────
FRC_LABEL_MAP: dict[str, str] = {
    "FRC0": "Motorway",
    "FRC1": "Major Road",
    "FRC2": "Other Major",
    "FRC3": "Secondary",
    "FRC4": "Local Connector",
    "FRC5": "Local",
    "FRC6": "Local High Importance",
    "FRC7": "Walking Path",
}

# ── OSM highway → FRC equivalent ─────────────────────────────────────────────
OSM_HIGHWAY_TO_FRC: dict[str, str] = {
    "motorway": "FRC0",
    "motorway_link": "FRC0",
    "trunk": "FRC1",
    "trunk_link": "FRC1",
    "primary": "FRC2",
    "primary_link": "FRC2",
    "secondary": "FRC3",
    "secondary_link": "FRC3",
    "tertiary": "FRC4",
    "tertiary_link": "FRC4",
    "residential": "FRC5",
    "living_street": "FRC5",
    "unclassified": "FRC5",
    "service": "FRC6",
    "pedestrian": "FRC7",
    "footway": "FRC7",
    "path": "FRC7",
    "cycleway": "FRC7",
}


# ─────────────────────────────────────────────────────────────────────────────
# T1 — Normalize TomTom
# ─────────────────────────────────────────────────────────────────────────────

def T1_normalize_tomtom(records: list[dict[str, Any]]) -> pd.DataFrame:
    """
    Chuẩn hóa danh sách TomTom record thành DataFrame.

    Tính: congestion_index, LOS, road_class_label, centroid (lat/lon),
          segment_length_km từ polyline, time_vn (timestamp VN timezone).

    Args:
        records: Output từ load_tomtom_records()

    Returns:
        pd.DataFrame với các cột đã chuẩn hóa.
    """
    rows: list[dict[str, Any]] = []

    for rec in records:
        flow = rec.get("flowSegmentData") or {}

        current_speed = _safe_float(flow.get("currentSpeed"))
        free_flow     = _safe_float(flow.get("freeFlowSpeed"))
        confidence    = _safe_float(flow.get("confidence"), default=0.7)
        travel_time   = _safe_float(flow.get("currentTravelTime"))
        free_tt       = _safe_float(flow.get("freeFlowTravelTime"))
        road_closure  = bool(flow.get("roadClosure", False))
        frc           = str(flow.get("frc", "")).upper()

        # Congestion index = (freeFlow - current) / freeFlow
        congestion_index = None
        speed_ratio = None
        if current_speed is not None and free_flow and free_flow > 0:
            congestion_index = round(
                max(0.0, min(1.0, (free_flow - current_speed) / free_flow)), 4
            )
            speed_ratio = round(current_speed / free_flow, 4)

        # LOS theo vận tốc
        los = _los_from_speed(current_speed)

        # Road class label
        road_class_label = FRC_LABEL_MAP.get(frc, "Unknown")

        # Polyline centroid và segment length
        coordinates = _extract_coordinates(flow)
        centroid_lat, centroid_lon = _polyline_centroid(coordinates)
        seg_len_km = _haversine_total_km(coordinates)

        # Parse timestamp
        extracted_at_raw = rec.get("extracted_at", "")
        time_utc, time_vn = _parse_timestamp(extracted_at_raw)

        rows.append({
            # Metadata
            "session_id":       rec.get("session_id", ""),
            "measurement_id":   rec.get("measurement_id", ""),
            "node_id":          rec.get("node_id", ""),
            "node_name":        rec.get("node_name", ""),
            "sample_id":        rec.get("sample_id", -1),
            "sampling_method":  rec.get("sampling_method", ""),
            "matched_road_name":rec.get("matched_road_name", ""),
            "target_road_names":rec.get("target_road_names", ""),
            "source_name":      rec.get("source_name", "tomtom_flow"),
            # Thời gian
            "extracted_at":     time_utc,
            "time_vn":          time_vn,
            # Vị trí gốc (sample point)
            "sample_lat":       _safe_float(rec.get("lat")),
            "sample_lon":       _safe_float(rec.get("lon")),
            # Vị trí polyline centroid
            "centroid_lat":     centroid_lat,
            "centroid_lon":     centroid_lon,
            "segment_length_km": seg_len_km,
            # Dữ liệu giao thông
            "frc":               frc,
            "road_class_label":  road_class_label,
            "current_speed":     current_speed,
            "free_flow_speed":   free_flow,
            "current_travel_time": travel_time,
            "free_flow_travel_time": free_tt,
            "confidence":        min(1.0, max(0.0, confidence)) if confidence is not None else 0.7,
            "road_closure":      road_closure,
            "congestion_index":  congestion_index,
            "speed_ratio":       speed_ratio,
            "los":               los,
        })

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    # Đảm bảo kiểu dữ liệu
    for col in ["current_speed", "free_flow_speed", "confidence",
                "congestion_index", "speed_ratio", "segment_length_km"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    logger.info("T1: %d TomTom records đã chuẩn hóa", len(df))
    return df


# ─────────────────────────────────────────────────────────────────────────────
# T2 — Normalize OSM
# ─────────────────────────────────────────────────────────────────────────────

def T2_normalize_osm(elements: list[dict[str, Any]]) -> pd.DataFrame:
    """
    Chuẩn hóa danh sách OSM way element thành DataFrame.

    Map highway tag → FRC equivalent, parse lanes/oneway/maxspeed.

    Args:
        elements: Output từ load_osm_edges()

    Returns:
        pd.DataFrame với các cột đã chuẩn hóa.
    """
    rows: list[dict[str, Any]] = []

    for elem in elements:
        # Hỗ trợ hai format:
        # 1. Standard OSM (Overpass): {"type":"way", "id":..., "center":{...}, "tags":{...}}
        # 2. Flat format (DACN-Traffic-ETL): {"osm_way_id":..., "lat":..., "lon":..., "highway":...}
        is_flat = "osm_way_id" in elem

        if is_flat:
            # Flat format — các field đã ở top-level
            way_id  = elem.get("osm_way_id")
            lat     = _safe_float(elem.get("lat"))
            lon     = _safe_float(elem.get("lon"))
            highway = str(elem.get("highway", "")).lower()
            name    = elem.get("road_name", "") or ""
            oneway  = _parse_oneway(elem.get("oneway"))
            lanes   = None  # không có trong flat format
            maxspeed = None  # không có trong flat format
            surface = ""
        else:
            # Standard OSM format
            tags    = elem.get("tags", {}) or {}
            center  = elem.get("center", {}) or {}
            way_id  = elem.get("id")
            lat     = _safe_float(center.get("lat"))
            lon     = _safe_float(center.get("lon"))
            highway = str(tags.get("highway", "")).lower()
            name    = tags.get("name", "") or ""
            oneway  = _parse_oneway(tags.get("oneway"))
            lanes   = _parse_lanes(tags.get("lanes"))
            maxspeed = _parse_maxspeed(tags.get("maxspeed"))
            surface = tags.get("surface", "") or ""

        frc_equiv = OSM_HIGHWAY_TO_FRC.get(highway, "FRC5")

        rows.append({
            "osm_way_id":      way_id,
            "osm_lat":         lat,
            "osm_lon":         lon,
            "osm_name":        name,
            "highway":         highway,
            "frc_equiv":       frc_equiv,
            "road_class_label": FRC_LABEL_MAP.get(frc_equiv, "Unknown"),
            "lanes":           lanes,
            "oneway":          oneway,
            "maxspeed_kmh":    maxspeed,
            "surface":         surface,
        })

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df["osm_way_id"] = pd.to_numeric(df["osm_way_id"], errors="coerce").astype("Int64")
    df["lanes"] = pd.to_numeric(df["lanes"], errors="coerce").astype("Int64")
    df["maxspeed_kmh"] = pd.to_numeric(df["maxspeed_kmh"], errors="coerce")

    logger.info("T2: %d OSM ways đã chuẩn hóa", len(df))
    return df


# ─────────────────────────────────────────────────────────────────────────────
# T4 — Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────

def T4_feature_engineering(df: pd.DataFrame) -> pd.DataFrame:
    """
    Feature engineering cho unified DataFrame sau T3 spatial join.

    Thêm các cột:
        time_slot       — "morning_peak" | "midday_peak" | "evening_peak" | "off_peak"
        is_congested    — bool (LOS D, E, hoặc F)
        delay_index     — (currentTT - freeFlowTT) / freeFlowTT
        date_str        — ngày dạng "YYYY-MM-DD" (VN timezone)
        hour_vn         — giờ (VN timezone)

    Args:
        df: DataFrame từ T3_spatial_join() hoặc T1_normalize_tomtom()

    Returns:
        DataFrame bổ sung thêm các feature columns.
    """
    df = df.copy()

    # Lấy giờ VN để phân time_slot
    if "time_vn" in df.columns and pd.api.types.is_datetime64_any_dtype(df["time_vn"]):
        hour = df["time_vn"].dt.hour
    elif "extracted_at" in df.columns:
        # Fallback: convert UTC sang VN time
        try:
            ts = pd.to_datetime(df["extracted_at"], utc=True)
            ts_vn = ts.dt.tz_convert("Asia/Ho_Chi_Minh")
            hour = ts_vn.dt.hour
            df["time_vn"] = ts_vn
            df["date_str"] = ts_vn.dt.strftime("%Y-%m-%d")
        except Exception:
            hour = pd.Series([12] * len(df), index=df.index)
    else:
        hour = pd.Series([12] * len(df), index=df.index)

    if "hour_vn" not in df.columns:
        df["hour_vn"] = hour

    if "date_str" not in df.columns and "time_vn" in df.columns:
        try:
            df["date_str"] = df["time_vn"].dt.strftime("%Y-%m-%d")
        except Exception:
            df["date_str"] = ""

    # time_slot
    def _slot(h: int) -> str:
        if 6 <= h <= 8:
            return "morning_peak"
        if 11 <= h <= 13:
            return "midday_peak"
        if 16 <= h <= 19:
            return "evening_peak"
        return "off_peak"

    df["time_slot"] = hour.apply(_slot)

    # is_congested: LOS A, B, C
    if "los" in df.columns:
        df["is_congested"] = df["los"].isin(["A", "B", "C"])
    else:
        df["is_congested"] = False

    # delay_index
    if "current_travel_time" in df.columns and "free_flow_travel_time" in df.columns:
        ctt = pd.to_numeric(df["current_travel_time"], errors="coerce")
        ftt = pd.to_numeric(df["free_flow_travel_time"], errors="coerce")
        df["delay_index"] = ((ctt - ftt) / ftt.replace(0, np.nan)).round(4)
    else:
        df["delay_index"] = np.nan

    logger.info("T4: Feature engineering hoàn tất (%d rows)", len(df))
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────────────────────

def _los_from_speed(speed_kmh: float | None) -> str:
    """Level of Service theo vận tốc (km/h)."""
    if speed_kmh is None or math.isnan(speed_kmh):
        return "unknown"
    if speed_kmh < 7:
        return "A"
    if speed_kmh < 13:
        return "B"
    if speed_kmh < 20:
        return "C"
    if speed_kmh < 30:
        return "D"
    if speed_kmh < 35:
        return "E"
    return "F"


def _safe_float(value: Any, default: float | None = None) -> float | None:
    """Chuyển đổi sang float an toàn."""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_timestamp(raw: str) -> tuple[str, datetime | None]:
    """Parse ISO timestamp string → (raw_str, datetime VN timezone)."""
    if not raw:
        return raw, None
    try:
        dt_utc = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        dt_vn = dt_utc.astimezone(TZ_VN)
        return raw, dt_vn
    except (ValueError, TypeError):
        return raw, None


def _extract_coordinates(flow: dict) -> list[tuple[float, float]]:
    """Trích xuất danh sách (lat, lon) từ flowSegmentData.coordinates."""
    try:
        coords = flow.get("coordinates", {}).get("coordinate", [])
        return [(c["latitude"], c["longitude"]) for c in coords
                if "latitude" in c and "longitude" in c]
    except (TypeError, KeyError, AttributeError):
        return []


def _polyline_centroid(coords: list[tuple[float, float]]) -> tuple[float | None, float | None]:
    """Tính centroid (mean lat, mean lon) của polyline."""
    if not coords:
        return None, None
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    return round(sum(lats) / len(lats), 7), round(sum(lons) / len(lons), 7)


def _haversine_total_km(coords: list[tuple[float, float]]) -> float | None:
    """Tính tổng độ dài polyline bằng công thức Haversine (km)."""
    if len(coords) < 2:
        return None
    R = 6371.0
    total = 0.0
    for (lat1, lon1), (lat2, lon2) in zip(coords[:-1], coords[1:]):
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
             * math.sin(dlon / 2) ** 2)
        total += R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(total, 4)


def _parse_lanes(raw: Any) -> int | None:
    """Parse OSM lanes field: handle '2', '1;2', null, 'unknown'."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ("unknown", "none", ""):
        return None
    # Nếu có dạng '1;2' → lấy giá trị đầu
    parts = s.split(";")
    try:
        return int(parts[0].strip())
    except ValueError:
        return None


def _parse_oneway(raw: Any) -> bool | None:
    """Chuẩn hóa OSM oneway tag sang bool."""
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if s in ("yes", "true", "1"):
        return True
    if s in ("no", "false", "0"):
        return False
    return None


def _parse_maxspeed(raw: Any) -> float | None:
    """Parse OSM maxspeed sang float km/h."""
    if raw is None:
        return None
    s = str(raw).strip().lower()
    # Các giá trị đặc biệt tại Việt Nam
    VN_DEFAULTS: dict[str, float] = {
        "vn:urban": 50.0,
        "vn:rural": 90.0,
        "vn:motorway": 120.0,
        "none": None,
        "unlimited": None,
        "walk": 10.0,
        "": None,
    }
    if s in VN_DEFAULTS:
        return VN_DEFAULTS[s]
    # Xử lý "60 mph" → km/h
    if "mph" in s:
        try:
            return round(float(s.replace("mph", "").strip()) * 1.60934, 1)
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None
