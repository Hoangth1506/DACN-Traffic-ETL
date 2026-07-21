"""
loader.py — Đọc và validate raw JSON files từ DACN-Traffic-ETL/outputs/raw_measurements/

Hai hàm chính:
    load_tomtom_records(filepath)  →  list[dict]
    load_osm_edges(filepath)       →  list[dict]

Cả hai hàm đều validate schema, log lỗi, và chỉ trả về record hợp lệ.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_TOMTOM_REQUIRED_META = {"node_id", "node_name", "extracted_at"}
_TOMTOM_FLOW_REQUIRED = {"currentSpeed", "freeFlowSpeed", "confidence"}

# Bộ đệm lưu trữ nội dung file OSM đã được parse để tránh đọc đĩa lặp lại
_OSM_FILE_CACHE: dict[str, list[dict[str, Any]]] = {}


def load_tomtom_records(filepath: Path | str) -> list[dict[str, Any]]:
    """
    Đọc file tomtom_flow_records.json từ một session directory.

    Nếu filepath là thư mục, tự tìm tomtom_flow_records.json bên trong.
    Validate schema, log warning cho record lỗi, trả về list record hợp lệ.

    Args:
        filepath: Path tới file JSON hoặc thư mục session.

    Returns:
        list[dict] — Các record có đủ field bắt buộc.
    """
    filepath = Path(filepath)
    if filepath.is_dir():
        candidate = filepath / "tomtom_flow_records.json"
        if not candidate.exists():
            logger.warning("Không tìm thấy tomtom_flow_records.json trong %s", filepath)
            return []
        filepath = candidate

    if not filepath.exists():
        logger.error("File không tồn tại: %s", filepath)
        return []

    try:
        raw: list[dict] = json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Không thể đọc %s: %s", filepath, exc)
        return []

    if not isinstance(raw, list):
        logger.error("Định dạng không hợp lệ (không phải array): %s", filepath)
        return []

    valid: list[dict] = []
    for i, record in enumerate(raw):
        issues = _validate_tomtom_record(record, index=i)
        if issues:
            for issue in issues:
                logger.warning("[TomTom][%s][#%d] %s", filepath.name, i, issue)
        else:
            valid.append(record)

    logger.info("TomTom %s: %d/%d records hợp lệ", filepath.name, len(valid), len(raw))
    return valid


def load_osm_edges(filepath: Path | str) -> list[dict[str, Any]]:
    """
    Đọc file osm_edges.json từ một session directory.

    Chỉ lấy elements có type=="way" và có "center" với lat/lon hợp lệ.

    Args:
        filepath: Path tới file JSON hoặc thư mục session.

    Returns:
        list[dict] — Các OSM way element hợp lệ.
    """
    filepath = Path(filepath)
    if filepath.is_dir():
        candidate = filepath / "osm_edges.json"
        if not candidate.exists():
            logger.warning("Không tìm thấy osm_edges.json trong %s", filepath)
            return []
        filepath = candidate

    if not filepath.exists():
        logger.error("File không tồn tại: %s", filepath)
        return []

    # Check cache
    cache_key = str(filepath.resolve())
    if cache_key in _OSM_FILE_CACHE:
        return _OSM_FILE_CACHE[cache_key]

    try:
        raw = json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Không thể đọc %s: %s", filepath, exc)
        return []

    # Chuẩn hoá: lấy danh sách elements
    if isinstance(raw, dict):
        elements = raw.get("elements", [])
    elif isinstance(raw, list):
        elements = raw
    else:
        logger.error("Định dạng OSM không hợp lệ: %s", filepath)
        return []

    valid: list[dict] = []
    skipped = 0
    for i, elem in enumerate(elements):
        if not isinstance(elem, dict):
            skipped += 1
            continue

        # Hỗ trợ hai format:
        # 1. Standard OSM: {"type": "way", "id": ..., "center": {"lat": ..., "lon": ...}, ...}
        # 2. Flat format (DACN-Traffic-ETL): {"osm_way_id": ..., "lat": ..., "lon": ..., "highway": ..., ...}
        is_standard = elem.get("type") == "way"
        is_flat = "osm_way_id" in elem and "lat" in elem and "lon" in elem

        if not is_standard and not is_flat:
            continue

        if is_standard:
            center = elem.get("center", {})
            if not isinstance(center, dict) or "lat" not in center or "lon" not in center:
                logger.debug("[OSM][%s][#%d] Thiếu center lat/lon — bỏ qua", filepath.name, i)
                skipped += 1
                continue
            if "id" not in elem:
                skipped += 1
                continue
        else:
            # Flat format — lat/lon đã ở top-level
            try:
                float(elem["lat"])
                float(elem["lon"])
            except (TypeError, ValueError):
                skipped += 1
                continue

        valid.append(elem)

    # Lưu vào bộ đệm cache
    _OSM_FILE_CACHE[cache_key] = valid

    logger.info("OSM %s: %d ways hợp lệ (bỏ qua %d)", filepath.name, len(valid), skipped)
    return valid


def load_session_metadata(session_dir: Path | str) -> dict[str, Any] | None:
    """Đọc metadata.json của một session directory."""
    session_dir = Path(session_dir)
    meta_path = session_dir / "metadata.json"
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Không thể đọc metadata %s: %s", meta_path, exc)
        return None


# ── Internal validators ──────────────────────────────────────────────────────

def _validate_tomtom_record(record: Any, index: int) -> list[str]:
    """Trả về danh sách lỗi (rỗng = hợp lệ)."""
    errors: list[str] = []
    if not isinstance(record, dict):
        return [f"Record #{index} không phải dict"]

    for field in _TOMTOM_REQUIRED_META:
        if field not in record or record[field] is None:
            errors.append(f"Thiếu metadata field '{field}'")

    flow = record.get("flowSegmentData")
    if not isinstance(flow, dict):
        if "currentSpeed" not in record:
            errors.append("Thiếu 'flowSegmentData'")
        return errors

    for field in _TOMTOM_FLOW_REQUIRED:
        if field not in flow or flow[field] is None:
            errors.append(f"flowSegmentData thiếu '{field}'")

    confidence = flow.get("confidence")
    if confidence is not None:
        try:
            c = float(confidence)
            if not (0.0 <= c <= 1.0):
                errors.append(f"confidence ngoài [0,1]: {c}")
        except (TypeError, ValueError):
            errors.append(f"confidence không phải số: {confidence!r}")

    return errors
