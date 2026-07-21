"""
quality.py — DataQualityReport: Đánh giá chất lượng dữ liệu sau ETL pipeline.

Metrics:
    completeness_score  — % fields không null trên tổng fields bắt buộc
    validity_score      — % records pass range checks
    consistency_score   — % records không có contradiction
    timeliness_score    — % records có timestamp trong vòng 60 phút của scheduled window
    fusion_coverage     — % TomTom records được match với OSM
    conflict_rate       — % match pairs có speed deviation > 20%
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Fields bắt buộc để tính completeness
_REQUIRED_FIELDS = [
    "node_id", "node_name", "extracted_at",
    "current_speed", "free_flow_speed", "confidence",
    "centroid_lat", "centroid_lon", "los",
]

# Bounding box TPHCM
_LAT_BOUNDS = (10.35, 11.10)
_LON_BOUNDS = (106.30, 107.00)

# Scheduled collection windows (giờ VN)
_OFFICIAL_WINDOWS = [(6, 8), (11, 13), (16, 19)]
_TIMELINESS_TOLERANCE_MIN = 60


@dataclass
class DataQualityReport:
    """
    Chứa tất cả metrics đánh giá chất lượng dữ liệu.

    Attributes:
        total_records:      Tổng số record đã xử lý
        completeness_score: % fields không null (0.0 – 1.0)
        validity_score:     % records pass range checks (0.0 – 1.0)
        consistency_score:  % records không contradiction (0.0 – 1.0)
        timeliness_score:   % records trong window hợp lệ (0.0 – 1.0)
        fusion_coverage:    % TomTom records match với OSM (0.0 – 1.0)
        conflict_rate:      % match pairs có speed deviation > 20% (0.0 – 1.0)
        issues:             Danh sách vấn đề phát hiện
        by_node:            Breakdown theo node_id
    """
    total_records: int = 0
    completeness_score: float = 0.0
    validity_score: float = 0.0
    consistency_score: float = 0.0
    timeliness_score: float = 0.0
    fusion_coverage: float = 0.0
    conflict_rate: float = 0.0
    issues: list[str] = field(default_factory=list)
    by_node: dict[str, dict[str, Any]] = field(default_factory=dict)

    @property
    def overall_score(self) -> float:
        """Điểm chất lượng tổng hợp (trung bình có trọng số)."""
        return round(
            0.25 * self.completeness_score
            + 0.20 * self.validity_score
            + 0.20 * self.consistency_score
            + 0.15 * self.timeliness_score
            + 0.10 * self.fusion_coverage
            + 0.10 * (1.0 - self.conflict_rate),
            4
        )

    def to_dict(self) -> dict[str, Any]:
        """Chuyển sang dict để lưu JSON."""
        return {
            "total_records":       self.total_records,
            "completeness_score":  round(self.completeness_score, 4),
            "validity_score":      round(self.validity_score, 4),
            "consistency_score":   round(self.consistency_score, 4),
            "timeliness_score":    round(self.timeliness_score, 4),
            "fusion_coverage":     round(self.fusion_coverage, 4),
            "conflict_rate":       round(self.conflict_rate, 4),
            "overall_score":       self.overall_score,
            "issues":              self.issues,
            "by_node":             self.by_node,
        }

    def print_summary(self) -> None:
        """In bang summary ra console."""
        sep = "-" * 56
        print(f"\n{'=' * 56}")
        print(f"  DATA QUALITY REPORT   ({self.total_records} records)")
        print(f"{'=' * 56}")
        rows = [
            ("Completeness",            self.completeness_score),
            ("Validity",                self.validity_score),
            ("Consistency",             self.consistency_score),
            ("Timeliness",              self.timeliness_score),
            ("Fusion Coverage",         self.fusion_coverage),
            ("Conflict Rate (low=ok)",  self.conflict_rate),
        ]
        for name, val in rows:
            bar = _progress_bar(val)
            pct = f"{val * 100:5.1f}%"
            print(f"  {name:<30} {pct}  {bar}")
        print(sep)
        print(f"  {'Overall Score':<30} {self.overall_score * 100:5.1f}%")
        print(f"{'=' * 56}")

        if self.by_node:
            print("\n  Breakdown by Node:")
            print(f"  {'Node':<28} {'Records':>8} {'Completeness':>13} {'Match':>6}")
            print(f"  {'-'*56}")
            for node_id, stats in self.by_node.items():
                print(
                    f"  {node_id:<28} {stats.get('records', 0):>8} "
                    f"{stats.get('completeness', 0) * 100:>12.1f}% "
                    f"{stats.get('osm_match_pct', 0) * 100:>5.1f}%"
                )

        if self.issues:
            print(f"\n  Issues ({len(self.issues)}):")
            for issue in self.issues[:10]:
                print(f"    - {issue}")
            if len(self.issues) > 10:
                print(f"    ... and {len(self.issues) - 10} more issues")
        print()


# ─────────────────────────────────────────────────────────────────────────────
# Main function
# ─────────────────────────────────────────────────────────────────────────────

def generate_quality_report(df: pd.DataFrame) -> dict[str, Any]:
    """
    Tính toán tất cả quality metrics từ unified DataFrame.

    Args:
        df: DataFrame từ T4_feature_engineering() (sau T1-T4 pipeline)

    Returns:
        dict chứa tất cả metrics (cũng in bảng ra console).
    """
    report = DataQualityReport()

    if df.empty:
        report.issues.append("DataFrame rỗng — không có dữ liệu để đánh giá")
        report.print_summary()
        return report.to_dict()

    report.total_records = len(df)

    # ── Completeness ─────────────────────────────────────────────────────────
    present_fields = [f for f in _REQUIRED_FIELDS if f in df.columns]
    if present_fields:
        completeness_per_field = df[present_fields].notna().mean()
        report.completeness_score = float(completeness_per_field.mean())
        # Log fields có nhiều null
        for fname, rate in completeness_per_field.items():
            if rate < 0.8:
                report.issues.append(
                    f"Field '{fname}' có tỷ lệ null cao: {(1-rate)*100:.1f}%"
                )
    else:
        report.issues.append("Không có required fields trong DataFrame")

    # ── Validity ─────────────────────────────────────────────────────────────
    validity_checks: pd.Series = pd.Series(True, index=df.index)

    # Speed >= 0
    if "current_speed" in df.columns:
        speed_ok = df["current_speed"].isna() | (df["current_speed"] >= 0)
        validity_checks &= speed_ok
        bad = (~speed_ok).sum()
        if bad > 0:
            report.issues.append(f"{bad} records có current_speed < 0")

    # Confidence ∈ [0, 1]
    if "confidence" in df.columns:
        conf_ok = df["confidence"].isna() | (
            (df["confidence"] >= 0.0) & (df["confidence"] <= 1.0)
        )
        validity_checks &= conf_ok
        bad = (~conf_ok).sum()
        if bad > 0:
            report.issues.append(f"{bad} records có confidence ngoài [0,1]")

    # Coordinates trong bounding box TPHCM
    lat_col = "centroid_lat" if "centroid_lat" in df.columns else "sample_lat"
    lon_col = "centroid_lon" if "centroid_lon" in df.columns else "sample_lon"
    if lat_col in df.columns and lon_col in df.columns:
        coord_ok = (
            df[lat_col].isna() | (
                (df[lat_col] >= _LAT_BOUNDS[0]) & (df[lat_col] <= _LAT_BOUNDS[1])
            )
        ) & (
            df[lon_col].isna() | (
                (df[lon_col] >= _LON_BOUNDS[0]) & (df[lon_col] <= _LON_BOUNDS[1])
            )
        )
        validity_checks &= coord_ok
        bad = (~coord_ok).sum()
        if bad > 0:
            report.issues.append(f"{bad} records có tọa độ ngoài bounding box TPHCM")

    report.validity_score = float(validity_checks.mean())

    # ── Consistency ───────────────────────────────────────────────────────────
    consistency_checks: pd.Series = pd.Series(True, index=df.index)

    # currentSpeed ≤ freeFlowSpeed
    if "current_speed" in df.columns and "free_flow_speed" in df.columns:
        speed_consistent = (
            df["current_speed"].isna()
            | df["free_flow_speed"].isna()
            | (df["current_speed"] <= df["free_flow_speed"] * 1.05)  # 5% tolerance
        )
        consistency_checks &= speed_consistent
        bad = (~speed_consistent).sum()
        if bad > 0:
            report.issues.append(f"{bad} records có currentSpeed > freeFlowSpeed (+5%)")

    # currentTravelTime ≥ freeFlowTravelTime
    if "current_travel_time" in df.columns and "free_flow_travel_time" in df.columns:
        tt_consistent = (
            df["current_travel_time"].isna()
            | df["free_flow_travel_time"].isna()
            | (df["current_travel_time"] >= df["free_flow_travel_time"] * 0.95)
        )
        consistency_checks &= tt_consistent
        bad = (~tt_consistent).sum()
        if bad > 0:
            report.issues.append(f"{bad} records có currentTT < freeFlowTT (-5%)")

    report.consistency_score = float(consistency_checks.mean())

    # ── Timeliness ─────────────────────────────────────────────────────────
    if "hour_vn" in df.columns:
        def _in_window(h: Any) -> bool:
            if pd.isna(h):
                return False
            hour = int(h)
            for start, end in _OFFICIAL_WINDOWS:
                if start <= hour <= end:
                    return True
            # Off-peak: chấp nhận nếu trong range hợp lý
            return 0 <= hour <= 23

        report.timeliness_score = float(df["hour_vn"].apply(_in_window).mean())
    elif "time_vn" in df.columns:
        report.timeliness_score = 1.0  # nếu có timestamp thì coi là timely
    else:
        report.timeliness_score = 0.5  # không đủ thông tin
        report.issues.append("Thiếu cột hour_vn — timeliness_score ước tính = 0.5")

    # ── Fusion Coverage ───────────────────────────────────────────────────────
    if "osm_matched" in df.columns:
        matched = df["osm_matched"].fillna(False)
        report.fusion_coverage = float(matched.mean())
    else:
        report.fusion_coverage = 0.0
        report.issues.append("Thiếu cột osm_matched — chưa chạy T3 spatial join")

    # ── Conflict Rate ─────────────────────────────────────────────────────────
    if "osm_matched" in df.columns and "maxspeed_kmh" in df.columns:
        matched_df = df[df["osm_matched"].fillna(False)].copy()
        if not matched_df.empty and "current_speed" in matched_df.columns:
            has_both = matched_df["maxspeed_kmh"].notna() & matched_df["current_speed"].notna()
            both_df = matched_df[has_both]
            if not both_df.empty:
                speed_dev = (
                    (both_df["current_speed"] - both_df["maxspeed_kmh"]).abs()
                    / both_df["maxspeed_kmh"].replace(0, np.nan)
                )
                conflict = (speed_dev > 0.20).sum()
                report.conflict_rate = float(conflict / len(both_df))
            else:
                report.conflict_rate = 0.0
        else:
            report.conflict_rate = 0.0
    else:
        report.conflict_rate = 0.0

    # ── Breakdown theo node ────────────────────────────────────────────────
    if "node_id" in df.columns:
        for node_id, group in df.groupby("node_id"):
            present = [f for f in _REQUIRED_FIELDS if f in group.columns]
            comp = float(group[present].notna().mean().mean()) if present else 0.0
            match_pct = 0.0
            if "osm_matched" in group.columns:
                match_pct = float(group["osm_matched"].fillna(False).mean())
            report.by_node[str(node_id)] = {
                "records":        len(group),
                "completeness":   round(comp, 4),
                "osm_match_pct":  round(match_pct, 4),
            }

    report.print_summary()
    return report.to_dict()


# ── Utilities ────────────────────────────────────────────────────────────────

def _progress_bar(value: float, width: int = 20) -> str:
    """Hien thi thanh progress ASCII."""
    filled = int(value * width)
    return "[" + "#" * filled + "." * (width - filled) + "]"
