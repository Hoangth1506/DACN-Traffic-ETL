"""
spatial_join.py — T3: Spatial join TomTom segments với OSM ways bằng KDTree.

Hàm chính:
    T3_spatial_join(tomtom_df, osm_df, threshold_m=50) → pd.DataFrame

Logic:
  1. Build KDTree từ OSM centroid coordinates (lat/lon)
  2. Với mỗi TomTom record, tìm OSM way gần nhất
  3. Nếu khoảng cách ≤ threshold_m → merge, ngược lại để null
  4. Trả về unified DataFrame với prefix tt_ cho TomTom, osm_ cho OSM
"""

from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np
import pandas as pd
from scipy.spatial import KDTree

logger = logging.getLogger(__name__)

# Bounding box xấp xỉ của TPHCM để validate coordinates
_HCMC_LAT_MIN, _HCMC_LAT_MAX = 10.35, 11.10
_HCMC_LON_MIN, _HCMC_LON_MAX = 106.30, 107.00

# Bộ đệm lưu trữ KDTree và OSM mapping đã tính toán của các nút giao
_SPATIAL_JOIN_CACHE = {}


def T3_spatial_join(
    tomtom_df: pd.DataFrame,
    osm_df: pd.DataFrame,
    threshold_m: float = 50.0,
) -> pd.DataFrame:
    """
    Match TomTom segments với OSM ways bằng nearest neighbor (KDTree).

    Dùng centroid_lat/centroid_lon của TomTom (từ T1) và
    osm_lat/osm_lon của OSM (từ T2). Match nếu khoảng cách ≤ threshold_m.

    Args:
        tomtom_df:   DataFrame từ T1_normalize_tomtom()
        osm_df:      DataFrame từ T2_normalize_osm()
        threshold_m: Ngưỡng match (mét), mặc định 50m

    Returns:
        Unified DataFrame với cột từ cả hai nguồn.
        Các cột OSM sẽ là NaN nếu không match được.
    """
    if tomtom_df.empty:
        logger.warning("T3: TomTom DataFrame rỗng — trả về empty DataFrame")
        return pd.DataFrame()

    result = tomtom_df.copy()

    # Khởi tạo các cột OSM với NaN
    osm_cols = [
        "osm_way_id", "osm_name", "highway", "frc_equiv",
        "lanes", "oneway", "maxspeed_kmh", "surface",
        "osm_distance_m", "osm_matched",
    ]
    for col in osm_cols:
        result[col] = np.nan if col not in ("osm_name", "highway",
                                             "surface", "osm_matched") else None

    result["osm_matched"] = False

    if osm_df.empty:
        logger.warning("T3: OSM DataFrame rỗng — không thể spatial join")
        return result

    # Khởi tạo cột string với dtype object để tránh FutureWarning khi gán string vào float64
    for str_col in ["osm_name", "highway", "frc_equiv", "surface"]:
        result[str_col] = result[str_col].astype(object)
    for num_col in ["osm_way_id", "lanes", "maxspeed_kmh", "osm_distance_m"]:
        result[num_col] = pd.to_numeric(result[num_col], errors="coerce")
    result["oneway"] = result["oneway"].astype(object)

    # Lấy node_id từ tomtom_df để làm cache key
    node_id = result["node_id"].iloc[0] if "node_id" in result.columns and len(result) > 0 else "unknown"
    cache_key = (node_id, len(osm_df), threshold_m)

    if cache_key in _SPATIAL_JOIN_CACHE:
        tree, osm_valid_reset, threshold_rad = _SPATIAL_JOIN_CACHE[cache_key]
    else:
        # Lọc OSM records có tọa độ hợp lệ
        osm_valid = osm_df.dropna(subset=["osm_lat", "osm_lon"]).copy()
        if osm_valid.empty:
            logger.warning("T3: Không có OSM record nào có tọa độ hợp lệ")
            return result

        # Chuyển lat/lon → radians để dùng với haversine distance
        osm_coords_rad = np.deg2rad(osm_valid[["osm_lat", "osm_lon"]].values)

        # Build KDTree trên tọa độ radian (dùng Euclidean distance xấp xỉ)
        tree = KDTree(osm_coords_rad)
        osm_valid_reset = osm_valid.reset_index(drop=True)
        R = 6_371_000.0
        threshold_rad = threshold_m / R
        _SPATIAL_JOIN_CACHE[cache_key] = (tree, osm_valid_reset, threshold_rad)

    # Lấy tọa độ TomTom (ưu tiên sample point vì đại diện cho vị trí camera/node thực tế, tránh polyline centroid quá xa)
    lat_col = "sample_lat" if "sample_lat" in result.columns else "centroid_lat"
    lon_col = "sample_lon" if "sample_lon" in result.columns else "centroid_lon"

    tt_valid_mask = result[lat_col].notna() & result[lon_col].notna()
    if not tt_valid_mask.any():
        logger.warning("T3: Không có TomTom record nào có tọa độ hợp lệ")
        return result

    tt_coords_rad = np.deg2rad(result.loc[tt_valid_mask, [lat_col, lon_col]].values)

    # Query KDTree — lấy nearest neighbor
    distances_rad, indices = tree.query(tt_coords_rad, k=1)

    # Chuyển khoảng cách Euclidean (radian) xấp xỉ sang mét
    # Sử dụng Earth radius = 6371000m
    R = 6_371_000.0
    distances_m = distances_rad * R

    osm_valid_reset = osm_valid_reset

    n_matched = 0
    for i, tt_idx in enumerate(result.index[tt_valid_mask]):
        dist_m = distances_m[i]
        osm_idx = indices[i]

        result.at[tt_idx, "osm_distance_m"] = round(float(dist_m), 2)

        if distances_rad[i] <= threshold_rad:
            osm_row = osm_valid_reset.iloc[osm_idx]
            result.at[tt_idx, "osm_matched"] = True
            result.at[tt_idx, "osm_way_id"]  = osm_row.get("osm_way_id")
            result.at[tt_idx, "osm_name"]     = osm_row.get("osm_name", "")
            result.at[tt_idx, "highway"]      = osm_row.get("highway", "")
            result.at[tt_idx, "frc_equiv"]    = osm_row.get("frc_equiv", "")
            result.at[tt_idx, "lanes"]        = osm_row.get("lanes")
            result.at[tt_idx, "oneway"]       = osm_row.get("oneway")
            result.at[tt_idx, "maxspeed_kmh"] = osm_row.get("maxspeed_kmh")
            result.at[tt_idx, "surface"]      = osm_row.get("surface", "")
            n_matched += 1

    total = tt_valid_mask.sum()
    coverage = n_matched / total * 100 if total > 0 else 0.0
    logger.info(
        "T3 Spatial Join: %d/%d TomTom records matched với OSM (%.1f%%), threshold=%dm",
        n_matched, total, coverage, int(threshold_m),
    )
    return result


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Tính khoảng cách Haversine giữa 2 điểm (mét)."""
    R = 6_371_000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
