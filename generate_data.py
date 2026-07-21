"""
generate_data.py — Script chạy toàn bộ ETL pipeline.

Tự động quét tất cả sessions trong DACN-Traffic-ETL/outputs/raw_measurements/,
chạy T1-T4 transformations, sinh unified_traffic.parquet và quality_report.json.

Usage:
    python generate_data.py                          # dùng path mặc định
    python generate_data.py --raw-dir <path>         # chỉ định raw_measurements dir
    python generate_data.py --out-dir <path>         # chỉ định output directory
    python generate_data.py --threshold 50           # spatial join threshold (mét)
    python generate_data.py --limit 5                # chỉ xử lý 5 sessions (debug)

Output:
    outputs/unified_traffic.parquet   — unified DataFrame (tất cả sessions)
    outputs/quality_report.json       — quality metrics
    outputs/session_index.csv         — index tất cả sessions đã xử lý
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd

# ── Thêm thư mục cha vào path để import etl package ─────────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
_PACKAGE_DIR = _SCRIPT_DIR
if str(_PACKAGE_DIR) not in sys.path:
    sys.path.insert(0, str(_PACKAGE_DIR))

from etl.loader import load_osm_edges, load_session_metadata, load_tomtom_records
from etl.quality import generate_quality_report
from etl.spatial_join import T3_spatial_join
from etl.transform import T1_normalize_tomtom, T2_normalize_osm, T4_feature_engineering
from etl.camera_model import build_camera_records, camera_records_summary
from etl.node_agent import run_node_agents, node_states_summary
from etl.performance_eval import compute_performance_metrics, print_performance_summary

# ── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("generate_data")

# ── Default paths ─────────────────────────────────────────────────────────────
_DEFAULT_RAW_DIR = _PACKAGE_DIR / "outputs" / "raw_measurements"
_DEFAULT_OUT_DIR = _PACKAGE_DIR / "outputs"


# ─────────────────────────────────────────────────────────────────────────────
# Core pipeline
# ─────────────────────────────────────────────────────────────────────────────

def discover_sessions(raw_dir: Path) -> list[Path]:
    """
    Duyệt cấu trúc thư mục raw_measurements/ và trả về danh sách session dirs.

    Cấu trúc: raw_measurements/<date>/<time>_<label>/
    Nhận dạng session directory bằng sự hiện diện của metadata.json.
    """
    sessions: list[Path] = []
    if not raw_dir.exists():
        logger.error("raw_dir không tồn tại: %s", raw_dir)
        return sessions

    # Duyệt qua các thư mục ngày (YYYY-MM-DD)
    for date_dir in sorted(raw_dir.iterdir()):
        if not date_dir.is_dir() or date_dir.name.startswith("."):
            continue
        # Duyệt qua các thư mục session
        for session_dir in sorted(date_dir.iterdir()):
            if not session_dir.is_dir():
                continue
            # Kiểm tra có metadata.json và tomtom_flow_records.json không
            if (session_dir / "metadata.json").exists() and \
               (session_dir / "tomtom_flow_records.json").exists():
                sessions.append(session_dir)

    logger.info("Tìm thấy %d sessions trong %s", len(sessions), raw_dir)
    return sessions


def process_session(
    session_dir: Path,
    threshold_m: float = 50.0,
) -> pd.DataFrame | None:
    """
    Xử lý một session directory: Load → T1 → T2 → T3 → T4.

    Args:
        session_dir:  Path tới thư mục session
        threshold_m:  Spatial join threshold (mét)

    Returns:
        pd.DataFrame hoặc None nếu không có dữ liệu hợp lệ.
    """
    # Suppress lower level module logs in workers to avoid screen pollution
    logging.getLogger("etl.loader").setLevel(logging.WARNING)
    logging.getLogger("etl.transform").setLevel(logging.WARNING)
    logging.getLogger("etl.spatial_join").setLevel(logging.WARNING)

    logger.debug("Processing session: %s", session_dir.name)

    # Đọc metadata
    meta = load_session_metadata(session_dir)

    # EXTRACT
    tomtom_records = load_tomtom_records(session_dir)
    osm_records = load_osm_edges(session_dir)

    if not tomtom_records:
        logger.warning("Session %s: không có TomTom records hợp lệ", session_dir.name)
        return None

    # Đính kèm session metadata vào mỗi record
    session_id = meta.get("measurement_id", session_dir.name) if meta else session_dir.name
    for rec in tomtom_records:
        rec["session_id"] = session_id
        rec["measurement_id"] = session_id

    # T1 — Normalize TomTom
    tomtom_df = T1_normalize_tomtom(tomtom_records)
    if tomtom_df.empty:
        return None

    # T2 — Normalize OSM
    osm_df = T2_normalize_osm(osm_records) if osm_records else pd.DataFrame()

    # T3 — Spatial Join
    unified_df = T3_spatial_join(tomtom_df, osm_df, threshold_m=threshold_m)

    # T4 — Feature Engineering
    unified_df = T4_feature_engineering(unified_df)

    return unified_df


def run_pipeline(
    raw_dir: Path,
    out_dir: Path,
    threshold_m: float = 50.0,
    limit: int | None = None,
) -> dict:
    """
    Chạy toàn bộ pipeline trên tất cả sessions.

    Args:
        raw_dir:     Thư mục raw_measurements/
        out_dir:     Thư mục xuất output
        threshold_m: Spatial join threshold (mét)
        limit:       Giới hạn số sessions (None = tất cả)

    Returns:
        dict chứa pipeline run stats.
    """
    run_start = datetime.now(timezone.utc)
    logger.info("═" * 60)
    logger.info("DACN-Dashboard ETL Pipeline bắt đầu")
    logger.info("raw_dir   = %s", raw_dir)
    logger.info("out_dir   = %s", out_dir)
    logger.info("threshold = %dm", int(threshold_m))
    logger.info("═" * 60)

    out_dir.mkdir(parents=True, exist_ok=True)

    # Discover sessions
    sessions = discover_sessions(raw_dir)
    if limit:
        sessions = sessions[:limit]
        logger.info("Giới hạn xử lý: %d sessions đầu tiên", limit)

    if not sessions:
        logger.error("Không tìm thấy sessions nào — kiểm tra lại raw_dir")
        return {"status": "error", "message": "No sessions found"}

    # ── PROCESS SESSIONS IN PARALLEL (Multi-processing) ──────────────────────
    all_frames: list[pd.DataFrame] = []
    session_index: list[dict] = []
    n_success, n_failed = 0, 0

    import concurrent.futures
    import multiprocessing

    max_workers = max(1, multiprocessing.cpu_count() - 1)
    logger.info("Bắt đầu xử lý song song với %d CPU workers...", max_workers)

    # Đặt độ ưu tiên logging cho các module phụ thành WARNING trong main process
    logging.getLogger("etl.loader").setLevel(logging.WARNING)
    logging.getLogger("etl.transform").setLevel(logging.WARNING)
    logging.getLogger("etl.spatial_join").setLevel(logging.WARNING)

    with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Gửi tất cả session tasks đi xử lý
        future_to_session = {
            executor.submit(process_session, s_dir, threshold_m): s_dir
            for s_dir in sessions
        }

        total_sessions = len(sessions)
        for i, future in enumerate(concurrent.futures.as_completed(future_to_session), start=1):
            session_dir = future_to_session[future]
            try:
                df = future.result()
                if df is not None and not df.empty:
                    all_frames.append(df)
                    n_success += 1
                    session_index.append({
                        "session_dir":  str(session_dir),
                        "session_name": session_dir.name,
                        "date":         session_dir.parent.name,
                        "records":      len(df),
                        "status":       "ok",
                    })
                else:
                    n_failed += 1
                    session_index.append({
                        "session_dir":  str(session_dir),
                        "session_name": session_dir.name,
                        "date":         session_dir.parent.name,
                        "records":      0,
                        "status":       "no_data",
                    })
            except Exception as exc:
                logger.error("Lỗi khi xử lý session %s: %s", session_dir.name, exc)
                n_failed += 1
                session_index.append({
                    "session_dir":  str(session_dir),
                    "session_name": session_dir.name,
                    "date":         session_dir.parent.name,
                    "records":      0,
                    "status":       f"error: {exc}",
                })
            
            # Chỉ hiển thị tiến trình tổng hợp định kỳ
            if i % 20 == 0 or i == total_sessions:
                logger.info("Tiến độ ETL: %d/%d sessions đã xử lý...", i, total_sessions)

    # Đặt lại mức logging mặc định sau khi hoàn thành
    logging.getLogger("etl.loader").setLevel(logging.INFO)
    logging.getLogger("etl.transform").setLevel(logging.INFO)
    logging.getLogger("etl.spatial_join").setLevel(logging.INFO)

    logger.info("Xử lý hoàn tất: %d thành công, %d thất bại", n_success, n_failed)

    if not all_frames:
        logger.error("Không có dữ liệu hợp lệ — pipeline kết thúc")
        return {"status": "error", "message": "No valid data produced"}

    # Gộp tất cả frames
    logger.info("Gộp %d DataFrames...", len(all_frames))
    unified_df = pd.concat(all_frames, ignore_index=True)
    logger.info("Tổng cộng: %d rows", len(unified_df))

    # Loại bỏ duplicate (cùng session + node + sample)
    dedup_cols = [c for c in ["session_id", "node_id", "sample_id"] if c in unified_df.columns]
    if dedup_cols:
        before = len(unified_df)
        unified_df = unified_df.drop_duplicates(subset=dedup_cols, keep="first")
        after = len(unified_df)
        if before != after:
            logger.info("Đã loại %d duplicate rows", before - after)

    # ── LOAD: Lưu Parquet ────────────────────────────────────────────────────
    parquet_path = out_dir / "unified_traffic.parquet"
    _save_parquet(unified_df, parquet_path)

    # ── LOAD: Lưu JSON summary ────────────────────────────────────────────────
    quality_path = out_dir / "quality_report.json"
    quality_report = generate_quality_report(unified_df)
    _save_json(quality_report, quality_path)

    # ── LOAD: Luu session index CSV ───────────────────────────────────────────
    index_path = out_dir / "session_index.csv"
    pd.DataFrame(session_index).to_csv(index_path, index=False, encoding="utf-8")
    logger.info("Session index: %s", index_path)

    # ── C0: Camera Model (Layer 1) ────────────────────────────────────────────
    logger.info("C0: Building camera records (Layer 1)...")
    cam_df = build_camera_records(unified_df)
    cam_path = out_dir / "camera_records.parquet"
    _save_parquet(cam_df, cam_path)
    cam_summary = camera_records_summary(cam_df)
    logger.info("C0: %d camera records, %d unique cameras",
                cam_summary["total_records"], cam_summary["unique_cameras"])

    # ── A1: Node Agent Fusion (Layer 2) ──────────────────────────────────────
    logger.info("A1: Running NodeAgent fusion (Layer 2)...")
    ns_df = run_node_agents(cam_df)
    ns_path = out_dir / "node_states.parquet"
    _save_parquet(ns_df, ns_path)
    ns_summary = node_states_summary(ns_df)
    logger.info("A1: %d node states (%d sessions)",
                ns_summary.get("total_node_states", 0), ns_summary.get("sessions", 0))

    # ── P1: Performance Evaluation (Layer 3) ─────────────────────────────────
    logger.info("P1: Computing performance metrics (Layer 3)...")
    perf_metrics = compute_performance_metrics(cam_df, ns_df)
    print_performance_summary(perf_metrics)
    perf_path = out_dir / "performance_metrics.json"
    _save_json(perf_metrics, perf_path)

    run_end = datetime.now(timezone.utc)
    elapsed = (run_end - run_start).total_seconds()

    run_stats = {
        "status":           "ok",
        "run_start_utc":    run_start.isoformat(),
        "run_end_utc":      run_end.isoformat(),
        "elapsed_seconds":  round(elapsed, 2),
        "sessions_found":   len(sessions),
        "sessions_ok":      n_success,
        "sessions_failed":  n_failed,
        "total_rows":       len(unified_df),
        "parquet_path":     str(parquet_path),
        "quality_path":     str(quality_path),
        "index_path":       str(index_path),
        "quality_overall":  quality_report.get("overall_score", 0.0),
    }

    run_log_path = out_dir / "run_log.json"
    _save_json(run_stats, run_log_path)

    logger.info("═" * 60)
    logger.info("Pipeline hoàn tất trong %.1fs", elapsed)
    logger.info("Output: %s", out_dir)
    logger.info("Quality score: %.1f%%", quality_report.get("overall_score", 0) * 100)
    logger.info("═" * 60)

    return run_stats


# ── I/O helpers ───────────────────────────────────────────────────────────────

def _save_parquet(df: pd.DataFrame, path: Path) -> None:
    """Lưu DataFrame ra Parquet."""
    try:
        # Chuyển datetime columns về string để tránh timezone issues với pyarrow
        df_save = df.copy()
        for col in df_save.select_dtypes(include=["datetimetz", "datetime64[ns, UTC]"]).columns:
            df_save[col] = df_save[col].dt.strftime("%Y-%m-%dT%H:%M:%S%z")
        df_save.to_parquet(path, index=False, engine="pyarrow")
        logger.info("Parquet saved → %s (%d rows, %d cols)", path, len(df), len(df.columns))
    except Exception as exc:
        logger.error("Không thể lưu Parquet: %s — thử lưu CSV thay thế", exc)
        csv_path = path.with_suffix(".csv")
        df.to_csv(csv_path, index=False, encoding="utf-8")
        logger.info("CSV fallback → %s", csv_path)


def _save_json(data: dict, path: Path) -> None:
    """Lưu dict ra JSON file."""
    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("JSON saved → %s", path)
    except Exception as exc:
        logger.error("Không thể lưu JSON %s: %s", path, exc)


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="DACN-Dashboard ETL — Chạy toàn bộ pipeline từ raw_measurements/",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=_DEFAULT_RAW_DIR,
        help=f"Thư mục raw_measurements (mặc định: {_DEFAULT_RAW_DIR})",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=_DEFAULT_OUT_DIR,
        help=f"Thư mục xuất output (mặc định: {_DEFAULT_OUT_DIR})",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=50.0,
        help="Spatial join threshold tính bằng mét (mặc định: 50)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Giới hạn số sessions để xử lý (debug mode)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Bật debug logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    stats = run_pipeline(
        raw_dir=args.raw_dir,
        out_dir=args.out_dir,
        threshold_m=args.threshold,
        limit=args.limit,
    )

    sys.exit(0 if stats.get("status") == "ok" else 1)


if __name__ == "__main__":
    main()
