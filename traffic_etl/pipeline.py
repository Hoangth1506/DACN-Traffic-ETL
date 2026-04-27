from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .config import load_etl_config, load_nodes
from .extract import extract_osm_edges, extract_tomtom_flow, geocode_nodes, get_api_key
from .io import append_jsonl, append_table, ensure_dirs, write_json, write_table
from .non_iid import distribution_stats, pairwise_non_iid_tests, write_svg_charts
from .report import build_reports
from .schedule import initial_collection_slots, is_inside_collection_window
from .transform import fuse_by_node, transform_osm_edges, transform_tomtom_records


def run_pipeline(
    nodes_path: Path = Path("config/nodes.yaml"),
    etl_path: Path = Path("config/etl.yaml"),
    respect_windows: bool = False,
) -> dict:
    nodes = load_nodes(nodes_path)
    etl = load_etl_config(etl_path)
    run_started_at = datetime.now(timezone.utc)
    is_official_window = is_inside_collection_window(run_started_at, etl)
    collection_type = (
        "official_collection_window"
        if is_official_window
        else "manual_test_outside_official_windows"
    )
    run_id = run_started_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if respect_windows and not is_official_window:
        return {"status": "skipped_outside_collection_window", "windows": etl.windows}

    dirs = ensure_dirs(etl.base_dir)
    api_key = get_api_key()
    geocoded_nodes = geocode_nodes(nodes, api_key)
    slots = initial_collection_slots(etl) if not api_key else None
    tomtom_records = extract_tomtom_flow(geocoded_nodes, etl, api_key, dirs["raw"], slots)
    osm_records = extract_osm_edges(geocoded_nodes, dirs["raw"])
    write_json(tomtom_records, dirs["raw"] / "tomtom_flow_records.json")
    write_json(geocoded_nodes, dirs["raw"] / "geocoded_nodes.json")
    write_json(geocoded_nodes, dirs["raw"] / "edge_nodes.json")

    observations = transform_tomtom_records(tomtom_records, etl)
    video_ai_path = dirs["processed"] / "video_ai_observations.csv"
    if video_ai_path.exists():
        video_observations = _load_video_ai_observations(video_ai_path, etl)
        observations = pd.concat([observations, video_observations], ignore_index=True)
    osm_edges = transform_osm_edges(osm_records)
    fusion = fuse_by_node(observations, etl)
    stats = distribution_stats(observations)
    tests = pairwise_non_iid_tests(observations)
    chart_paths = write_svg_charts(observations, fusion, dirs["charts"])

    table_outputs = {
        "traffic_observations": write_table(observations, dirs["processed"] / "traffic_observations"),
        "osm_edges": write_table(osm_edges, dirs["raw"] / "osm_edges"),
        "node_fusion": write_table(fusion, dirs["processed"] / "node_fusion"),
        "non_iid_stats": write_table(stats, dirs["processed"] / "non_iid_stats"),
        "non_iid_tests": write_table(tests, dirs["processed"] / "non_iid_tests"),
    }

    run_context = {
        "run_id": run_id,
        "run_started_at": run_started_at.replace(microsecond=0).isoformat(),
        "is_official_collection_window": is_official_window,
        "collection_type": collection_type,
    }
    observations_with_run = _with_run_context(observations, run_context)
    fusion_with_run = _with_run_context(fusion, run_context)
    stats_with_run = _with_run_context(stats, run_context)
    tests_with_run = _with_run_context(tests, run_context)
    history_dir = dirs["history"] / run_started_at.astimezone(timezone.utc).strftime("%Y-%m-%d") / run_started_at.astimezone(timezone.utc).strftime("%H-%M-%S")
    history_outputs = {
        "traffic_observations": write_table(observations_with_run, history_dir / "traffic_observations"),
        "node_fusion": write_table(fusion_with_run, history_dir / "node_fusion"),
        "non_iid_stats": write_table(stats_with_run, history_dir / "non_iid_stats"),
        "non_iid_tests": write_table(tests_with_run, history_dir / "non_iid_tests"),
    }
    append_outputs = {
        "traffic_observations_all_csv": append_table(observations_with_run, dirs["processed"] / "traffic_observations_all.csv"),
        "traffic_observations_all_jsonl": append_jsonl(observations_with_run.to_dict(orient="records"), dirs["processed"] / "traffic_observations_all.jsonl"),
        "node_fusion_all_csv": append_table(fusion_with_run, dirs["processed"] / "node_fusion_all.csv"),
        "node_fusion_all_jsonl": append_jsonl(fusion_with_run.to_dict(orient="records"), dirs["processed"] / "node_fusion_all.jsonl"),
    }

    metadata = {
        "status": "ok",
        "run_id": run_id,
        "run_started_at": run_context["run_started_at"],
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "is_official_collection_window": is_official_window,
        "collection_type": collection_type,
        "api_key_source": "TOMTOM_API_KEY environment variable" if api_key else "not_set",
        "tomtom_mode": "live_current_flow" if api_key else "synthetic_initial_history_fallback",
        "data_readiness_note": (
            "Live TomTom data collected from Traffic Flow API."
            if api_key
            else "Synthetic fallback/backfill data for ETL testing only; not real TomTom traffic observations."
        ),
        "initial_history_days": etl.initial_history_days,
        "auto_collection_months": etl.auto_collection_months,
        "windows": etl.windows,
        "timezone": etl.timezone,
        "lineage": [
            "config/nodes.yaml: manually selected edge-node coordinates and corridor sample points from Google Maps/OpenStreetMap.",
            "TomTom Traffic Flow Segment Data API: current speed, free-flow speed, travel time, confidence, road closure.",
            "OpenStreetMap Overpass API: nearby road topology and way metadata around each edge node.",
            "PyTorch YOLO video AI: object detection, vehicle counts, line-crossing flow, velocity from tracked displacement when video_ai_observations.csv exists.",
            "synthetic_fallback: explicitly marked fallback used only when API/backfill data is unavailable.",
        ],
        "edge_node_image": str(Path("ảnh 3 điểm.jpg").resolve()),
        "outputs": table_outputs,
        "history_outputs": history_outputs,
        "append_outputs": append_outputs,
        "charts": {name: str(path) for name, path in chart_paths.items()},
        "nodes": geocoded_nodes,
    }
    docx_path, pdf_path = build_reports(dirs["report"], observations, fusion, stats, tests, chart_paths, metadata)
    metadata["report_docx"] = str(docx_path)
    metadata["report_pdf"] = str(pdf_path)
    main_summary = {
        "generated_at": metadata["generated_at"],
        "run_id": metadata["run_id"],
        "run_started_at": metadata["run_started_at"],
        "is_official_collection_window": metadata["is_official_collection_window"],
        "collection_type": metadata["collection_type"],
        "collection_windows": metadata["windows"],
        "tomtom_mode": metadata["tomtom_mode"],
        "data_readiness_note": metadata["data_readiness_note"],
        "has_video_ai_output": video_ai_path.exists(),
        "main_result_file": str(dirs["processed"] / "node_fusion.json"),
        "detailed_observation_file": str(dirs["processed"] / "traffic_observations.json"),
        "history_dir": str(history_dir),
        "append_files": append_outputs,
        "video_ai_file": str(video_ai_path) if video_ai_path.exists() else None,
        "node_fusion": fusion.to_dict(orient="records"),
        "non_iid_stats": stats.to_dict(orient="records"),
        "non_iid_tests": tests.to_dict(orient="records"),
        "lineage": metadata["lineage"],
    }
    write_json(main_summary, dirs["processed"] / "main_summary.json")
    write_json(metadata, dirs["report"] / "metadata.json")
    return metadata


def _with_run_context(df: pd.DataFrame, context: dict) -> pd.DataFrame:
    result = df.copy()
    for key, value in reversed(list(context.items())):
        result.insert(0, key, value)
    return result


def _load_video_ai_observations(path: Path, etl) -> pd.DataFrame:
    df = pd.read_csv(path)
    rows = []
    for idx, row in df.iterrows():
        velocity = row.get("velocity_kmph")
        if pd.isna(velocity):
            velocity = None
        free_flow = 45.0
        ratio = None if velocity is None else max(0.0, min(1.0, 1.0 - float(velocity) / free_flow))
        rows.append(
            {
                "node_id": row["node_id"],
                "node_name": row["node_id"],
                "sample_id": f"video-{idx}",
                "lat": None,
                "lon": None,
                "velocity_kmph": velocity,
                "free_flow_kmph": free_flow,
                "current_travel_time": None,
                "free_flow_travel_time": None,
                "confidence": 0.8 if velocity is not None else 0.4,
                "recency_score": 1.0,
                "source_quality": etl.source_quality["pytorch_yolo_video"],
                "congestion_ratio": ratio,
                "density_proxy": row.get("density_proxy"),
                "los": _los_from_velocity_for_pipeline(velocity),
                "congestion_level": "video_ai",
                "road_closure": False,
                "source_name": "pytorch_yolo_video",
                "source_api": "PyTorch + Ultralytics YOLO + OpenCV video processing",
                "raw_path": row.get("video_path", ""),
                "extract_error": "",
                "extracted_at": row.get("timestamp", ""),
            }
        )
    return pd.DataFrame(rows)


def _los_from_velocity_for_pipeline(velocity):
    from .transform import los_from_velocity

    return los_from_velocity(velocity)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run traffic ETL and Non-IID report generation.")
    parser.add_argument("--nodes", default="config/nodes.yaml")
    parser.add_argument("--etl", default="config/etl.yaml")
    parser.add_argument("--respect-windows", action="store_true")
    args = parser.parse_args()
    result = run_pipeline(Path(args.nodes), Path(args.etl), args.respect_windows)
    print(f"status={result.get('status')}")
    if result.get("status") == "ok":
        print(f"report_docx={result.get('report_docx')}")
        print(f"report_pdf={result.get('report_pdf')}")
