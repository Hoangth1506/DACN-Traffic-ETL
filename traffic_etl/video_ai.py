from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class TrackState:
    track_id: int
    class_name: str
    cx: float
    cy: float
    last_frame: int
    first_frame: int
    distance_px: float = 0.0
    counted: bool = False


VEHICLE_ALIASES = {
    "motorcycle": "motorcycle",
    "motorbike": "motorcycle",
    "bicycle": "motorcycle",
    "car": "car",
    "bus": "bus",
    "truck": "truck",
}

EQUIVALENT_WEIGHTS = {
    "motorcycle": 1,
    "car": 4,
    "bus": 16,
    "truck": 16,
}


def load_video_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def run_video_ai(config_path: Path = Path("config/video_ai.json"), output_dir: Path = Path("outputs/processed")) -> pd.DataFrame:
    cfg = load_video_config(config_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    _assert_ai_dependencies()
    all_rows: list[dict[str, Any]] = []
    for video in cfg["videos"]:
        all_rows.append(_process_video(video, cfg))
    df = pd.DataFrame(all_rows)
    csv_path = output_dir / "video_ai_observations.csv"
    json_path = output_dir / "video_ai_observations.json"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    df.to_json(json_path, orient="records", force_ascii=False, indent=2)
    return df


def _assert_ai_dependencies() -> None:
    missing = []
    for module_name in ["torch", "cv2", "ultralytics"]:
        try:
            __import__(module_name)
        except ImportError:
            missing.append(module_name)
    if missing:
        raise RuntimeError(
            "Missing AI dependencies: "
            + ", ".join(missing)
            + ". Install them with: python -m pip install -r requirements.txt"
        )


def _process_video(video_cfg: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    import cv2
    import torch
    from ultralytics import YOLO

    video_path = Path(video_cfg["path"])
    if not video_path.exists():
        raise FileNotFoundError(str(video_path))

    model = YOLO(cfg.get("model", "yolov8n.pt"))
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    line_y = height * float(cfg.get("line_y_ratio", 0.55))
    stride = int(cfg.get("frame_stride", 10))
    meters_per_pixel = float(cfg.get("meters_per_pixel", 0.08))
    conf = float(cfg.get("confidence_threshold", 0.25))

    tracks: dict[int, TrackState] = {}
    next_track_id = 1
    vehicle_counts = {name: 0 for name in EQUIVALENT_WEIGHTS}
    line_crossings = 0
    processed_frames = 0
    detections_total = 0

    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % stride != 0:
            frame_idx += 1
            continue
        processed_frames += 1
        results = model.predict(frame, conf=conf, verbose=False, device=device)
        detections = _extract_vehicle_detections(results[0], cfg.get("vehicle_classes", []))
        detections_total += len(detections)
        tracks, next_track_id, crossed = _update_tracks(
            tracks=tracks,
            detections=detections,
            next_track_id=next_track_id,
            frame_idx=frame_idx,
            line_y=line_y,
        )
        line_crossings += crossed
        for det in detections:
            vehicle_counts[det["class_name"]] += 1
        frame_idx += 1
    cap.release()

    duration_sec = frame_count / fps if fps else 0.0
    speed_values = []
    for track in tracks.values():
        elapsed = max((track.last_frame - track.first_frame) / fps, 1e-6)
        if track.distance_px > 0 and elapsed > 0:
            speed_values.append((track.distance_px * meters_per_pixel / elapsed) * 3.6)
    avg_velocity = sum(speed_values) / len(speed_values) if speed_values else None
    equivalent_count = sum(vehicle_counts[k] * EQUIVALENT_WEIGHTS[k] for k in EQUIVALENT_WEIGHTS)
    flow_rate = (line_crossings / duration_sec) * 60 if duration_sec > 0 else 0.0
    density_proxy = equivalent_count / max(processed_frames, 1)

    return {
        "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "node_id": video_cfg["node_id"],
        "camera_id": video_cfg["camera_id"],
        "video_path": str(video_path),
        "source_name": "pytorch_yolo_video",
        "source_api": "PyTorch + Ultralytics YOLO + OpenCV video processing",
        "device": device,
        "fps": fps,
        "frame_count": frame_count,
        "processed_frames": processed_frames,
        "detections_total": detections_total,
        "motorcycle_count": vehicle_counts["motorcycle"],
        "car_count": vehicle_counts["car"],
        "bus_count": vehicle_counts["bus"],
        "truck_count": vehicle_counts["truck"],
        "equivalent_vehicle_count": equivalent_count,
        "line_crossing_flow_count": line_crossings,
        "flow_rate_vehicles_per_min": round(flow_rate, 4),
        "velocity_kmph": round(avg_velocity, 4) if avg_velocity is not None else None,
        "density_proxy": round(density_proxy, 4),
        "meters_per_pixel": meters_per_pixel,
        "line_y_ratio": cfg.get("line_y_ratio", 0.55),
        "model": cfg.get("model", "yolov8n.pt"),
    }


def _extract_vehicle_detections(result: Any, allowed_classes: list[str]) -> list[dict[str, Any]]:
    names = result.names
    allowed = set(allowed_classes or EQUIVALENT_WEIGHTS)
    detections = []
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return detections
    for box in boxes:
        class_id = int(box.cls.item())
        raw_name = str(names.get(class_id, class_id))
        class_name = VEHICLE_ALIASES.get(raw_name)
        if not class_name or class_name not in allowed:
            continue
        xyxy = box.xyxy[0].tolist()
        x1, y1, x2, y2 = [float(v) for v in xyxy]
        detections.append(
            {
                "class_name": class_name,
                "confidence": float(box.conf.item()),
                "cx": (x1 + x2) / 2,
                "cy": (y1 + y2) / 2,
            }
        )
    return detections


def _update_tracks(
    tracks: dict[int, TrackState],
    detections: list[dict[str, Any]],
    next_track_id: int,
    frame_idx: int,
    line_y: float,
    max_match_distance: float = 80.0,
) -> tuple[dict[int, TrackState], int, int]:
    crossed = 0
    assigned: set[int] = set()
    for det in detections:
        best_id = None
        best_distance = max_match_distance
        for track_id, track in tracks.items():
            if track_id in assigned or track.class_name != det["class_name"]:
                continue
            distance = math.hypot(det["cx"] - track.cx, det["cy"] - track.cy)
            if distance < best_distance:
                best_id = track_id
                best_distance = distance
        if best_id is None:
            tracks[next_track_id] = TrackState(
                track_id=next_track_id,
                class_name=det["class_name"],
                cx=det["cx"],
                cy=det["cy"],
                first_frame=frame_idx,
                last_frame=frame_idx,
            )
            assigned.add(next_track_id)
            next_track_id += 1
            continue

        track = tracks[best_id]
        previous_y = track.cy
        track.distance_px += math.hypot(det["cx"] - track.cx, det["cy"] - track.cy)
        track.cx = det["cx"]
        track.cy = det["cy"]
        track.last_frame = frame_idx
        if not track.counted and (previous_y - line_y) * (track.cy - line_y) <= 0 and abs(previous_y - track.cy) > 2:
            track.counted = True
            crossed += 1
        assigned.add(best_id)

    stale = [track_id for track_id, track in tracks.items() if frame_idx - track.last_frame > 90]
    for track_id in stale:
        del tracks[track_id]
    return tracks, next_track_id, crossed


def main() -> None:
    parser = argparse.ArgumentParser(description="Run PyTorch/YOLO video AI traffic extraction.")
    parser.add_argument("--config", default="config/video_ai.json")
    parser.add_argument("--output-dir", default="outputs/processed")
    args = parser.parse_args()
    df = run_video_ai(Path(args.config), Path(args.output_dir))
    print(f"video_ai_rows={len(df)}")
    print(f"output={Path(args.output_dir) / 'video_ai_observations.csv'}")
