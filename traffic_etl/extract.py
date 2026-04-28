from __future__ import annotations

import json
import math
import os
import re
import time
import urllib.parse
import urllib.request
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import EtlConfig, NodeConfig

TOMTOM_FLOW_URL = (
    "https://api.tomtom.com/traffic/services/4/flowSegmentData/"
    "absolute/10/json"
)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _get_json(url: str, params: dict[str, Any], timeout: int = 20) -> dict[str, Any]:
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(full_url, headers={"User-Agent": "DACN-traffic-etl/1.0"})
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(2 ** attempt)  # Chờ 1s, 2s trước khi thử lại


def geocode_nodes(nodes: list[NodeConfig], api_key: str | None) -> list[dict[str, Any]]:
    edge_nodes: list[dict[str, Any]] = []
    for node in nodes:
        record = asdict(node)
        record.update(
            {
                "lat": node.fallback_lat,
                "lon": node.fallback_lon,
                "geocode_source": "manual_config",
                "source_api": "config/nodes.yaml",
                "extracted_at": utc_now_iso(),
            }
        )
        edge_nodes.append(record)
    return edge_nodes


def sample_points(lat: float, lon: float, radius_m: int, count: int) -> list[dict[str, float]]:
    if count <= 1:
        return [{"sample_id": 0, "lat": lat, "lon": lon, "offset_m": 0.0}]
    points = [{"sample_id": 0, "lat": lat, "lon": lon, "offset_m": 0.0}]
    rings = count - 1
    for idx in range(rings):
        angle = 2 * math.pi * idx / rings
        distance = radius_m * 0.65
        dlat = (distance * math.sin(angle)) / 111_320
        dlon = (distance * math.cos(angle)) / (111_320 * math.cos(math.radians(lat)))
        points.append(
            {
                "sample_id": idx + 1,
                "lat": lat + dlat,
                "lon": lon + dlon,
                "offset_m": round(distance, 2),
            }
        )
    return points


def node_sample_points(node: dict[str, Any], etl: EtlConfig) -> list[dict[str, Any]]:
    configured = str(node.get("sample_points") or "").strip()
    if configured:
        points: list[dict[str, Any]] = []
        for idx, item in enumerate(configured.split("|")):
            raw_lat, raw_lon = item.split(",", 1)
            points.append(
                {
                    "sample_id": idx,
                    "lat": float(raw_lat.strip()),
                    "lon": float(raw_lon.strip()),
                    "offset_m": 0.0,
                    "sampling_method": "manual_corridor",
                }
            )
        return points
    target_names = _target_road_names(node)
    if target_names:
        try:
            osm_points = _osm_corridor_sample_points(node, target_names, etl.sample_points_per_node)
            if osm_points:
                return osm_points
        except Exception:
            pass
    return [
        {**point, "sampling_method": "radius_ring"}
        for point in sample_points(
            float(node["lat"]),
            float(node["lon"]),
            int(node["radius_m"]),
            etl.sample_points_per_node,
        )
    ]


def _target_road_names(node: dict[str, Any]) -> list[str]:
    raw = str(node.get("target_road_names") or "").strip()
    if not raw:
        return []
    return [item.strip() for item in re.split(r"[|,]", raw) if item.strip()]


def _osm_corridor_sample_points(
    node: dict[str, Any],
    target_names: list[str],
    sample_count: int,
) -> list[dict[str, Any]]:
    radius_m = int(node.get("radius_m") or 900)
    escaped_names = "|".join(re.escape(name) for name in target_names)
    query = f"""
    [out:json][timeout:25];
    (
      way(around:{radius_m},{node['lat']},{node['lon']})["highway"]["name"~"^({escaped_names})$"];
    );
    out body;
    >;
    out skel qt;
    """
    data = _get_json(OVERPASS_URL, {"data": query}, timeout=35)
    node_coords: dict[int, tuple[float, float]] = {}
    ways: list[dict[str, Any]] = []
    for element in data.get("elements", []):
        if element.get("type") == "node":
            node_coords[int(element["id"])] = (float(element["lat"]), float(element["lon"]))
        elif element.get("type") == "way":
            ways.append(element)

    candidates: list[dict[str, Any]] = []
    center_lat = float(node["lat"])
    center_lon = float(node["lon"])
    for way in ways:
        road_name = way.get("tags", {}).get("name", "")
        for osm_node_id in way.get("nodes", []):
            coord = node_coords.get(int(osm_node_id))
            if not coord:
                continue
            lat, lon = coord
            candidates.append(
                {
                    "lat": lat,
                    "lon": lon,
                    "road_name": road_name,
                    "distance_m": _distance_m(center_lat, center_lon, lat, lon),
                }
            )
    if not candidates:
        return []

    candidates = sorted(_dedupe_points(candidates), key=lambda item: item["distance_m"])
    selected = _spread_points(candidates[: max(sample_count * 6, sample_count)], sample_count)
    return [
        {
            "sample_id": idx,
            "lat": point["lat"],
            "lon": point["lon"],
            "offset_m": round(point["distance_m"], 2),
            "sampling_method": "osm_corridor",
            "matched_road_name": point["road_name"],
        }
        for idx, point in enumerate(selected)
    ]


def _dedupe_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[float, float]] = set()
    result: list[dict[str, Any]] = []
    for point in points:
        key = (round(float(point["lat"]), 6), round(float(point["lon"]), 6))
        if key in seen:
            continue
        seen.add(key)
        result.append(point)
    return result


def _spread_points(points: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    if len(points) <= count:
        return points
    if count <= 1:
        return [points[0]]
    indexes = [round(i * (len(points) - 1) / (count - 1)) for i in range(count)]
    return [points[index] for index in indexes]


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def extract_tomtom_flow(
    geocoded_nodes: list[dict[str, Any]],
    etl: EtlConfig,
    api_key: str | None,
    raw_dir: Path,
    synthetic_slots: list[datetime] | None = None,
) -> list[dict[str, Any]]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    extracted_at = utc_now_iso()
    for node in geocoded_nodes:
        for point in node_sample_points(node, etl):
            base = {
                "node_id": node["node_id"],
                "node_name": node["name"],
                "sample_id": point["sample_id"],
                "lat": point["lat"],
                "lon": point["lon"],
                "sampling_method": point.get("sampling_method", ""),
                "matched_road_name": point.get("matched_road_name", ""),
                "target_road_names": node.get("target_road_names", ""),
                "source_name": "tomtom_flow",
                "source_api": "TomTom Traffic Flow Segment Data API",
                "extracted_at": extracted_at,
            }
            if not api_key:
                slots = synthetic_slots or [datetime.now(timezone.utc)]
                for slot in slots:
                    records.append(
                        {
                            **base,
                            "source_name": "synthetic_fallback",
                            "source_api": "Synthetic fallback for initial history or missing TomTom key",
                            "extracted_at": slot.astimezone(timezone.utc).replace(microsecond=0).isoformat(),
                            **_synthetic_flow(node["node_id"], point["sample_id"], slot),
                        }
                    )
                continue
            try:
                data = _get_json(
                    TOMTOM_FLOW_URL,
                    {
                        "key": api_key,
                        "point": f"{point['lat']},{point['lon']}",
                        "unit": "KMPH",
                    },
                )
                raw_path = raw_dir / f"tomtom_flow_{node['node_id']}_{point['sample_id']}.json"
                raw_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                segment = data.get("flowSegmentData", {})
                records.append({**base, "raw_path": str(raw_path), "flowSegmentData": segment})
                time.sleep(0.15)
            except Exception as exc:
                records.append(
                    {
                        **base,
                        "source_name": "synthetic_fallback",
                        "source_api": "Synthetic fallback after TomTom failure",
                        "extract_error": type(exc).__name__,
                        **_synthetic_flow(node["node_id"], point["sample_id"]),
                    }
                )
    return records


def _synthetic_flow(node_id: str, sample_id: int, slot: datetime | None = None) -> dict[str, Any]:
    profiles = {
        "N01_LY_THUONG_KIET": (23.0, 42.0),
        "N02_CONG_HOA": (17.0, 45.0),
        "N03_TRUONG_CHINH": (12.0, 38.0),
    }
    current, free = profiles.get(node_id, (20.0, 40.0))
    hour = slot.hour if slot else 8
    peak_penalty = 0.0
    if 6 <= hour <= 8:
        peak_penalty = 2.0
    elif 11 <= hour <= 13:
        peak_penalty = 1.0
    elif 16 <= hour <= 19:
        peak_penalty = 4.0
    variation = ((sample_id % 5) - 2) * 1.8 - peak_penalty
    speed = max(4.0, current + variation)
    free_speed = max(speed + 5.0, free)
    return {
        "flowSegmentData": {
            "currentSpeed": round(speed, 2),
            "freeFlowSpeed": round(free_speed, 2),
            "currentTravelTime": round(1000 / max(speed, 1), 2),
            "freeFlowTravelTime": round(1000 / max(free_speed, 1), 2),
            "confidence": round(0.55 + (sample_id % 4) * 0.08, 2),
            "roadClosure": False,
        },
    }


def extract_osm_edges(geocoded_nodes: list[dict[str, Any]], raw_dir: Path) -> list[dict[str, Any]]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    extracted_at = utc_now_iso()
    records: list[dict[str, Any]] = []
    for node in geocoded_nodes:
        try:
            query = f"""
            [out:json][timeout:25];
            way(around:{int(node['radius_m'])},{node['lat']},{node['lon']})["highway"];
            out tags center;
            """
            data = _get_json(OVERPASS_URL, {"data": query}, timeout=35)
            raw_path = raw_dir / f"osm_edges_{node['node_id']}.json"
            raw_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            for element in data.get("elements", []):
                tags = element.get("tags", {})
                center = element.get("center", {})
                records.append(
                    {
                        "node_id": node["node_id"],
                        "node_name": node["name"],
                        "osm_way_id": element.get("id"),
                        "road_name": tags.get("name", ""),
                        "highway": tags.get("highway", ""),
                        "oneway": tags.get("oneway", ""),
                        "lat": center.get("lat"),
                        "lon": center.get("lon"),
                        "source_name": "osm_topology",
                        "source_api": "OpenStreetMap Overpass API",
                        "raw_path": str(raw_path),
                        "extracted_at": extracted_at,
                    }
                )
            time.sleep(0.25)
        except Exception as exc:
            records.extend(_synthetic_osm_edges(node, extracted_at, type(exc).__name__))
    return records


def _synthetic_osm_edges(node: dict[str, Any], extracted_at: str, error: str) -> list[dict[str, Any]]:
    roads = [node["name"], f"{node['name']} nhanh 1", f"{node['name']} nhanh 2"]
    return [
        {
            "node_id": node["node_id"],
            "node_name": node["name"],
            "osm_way_id": f"synthetic-{node['node_id']}-{idx}",
            "road_name": road,
            "highway": "primary" if idx == 0 else "secondary",
            "oneway": "",
            "lat": node["lat"],
            "lon": node["lon"],
            "source_name": "synthetic_fallback",
            "source_api": "Synthetic OSM topology fallback",
            "extract_error": error,
            "extracted_at": extracted_at,
        }
        for idx, road in enumerate(roads)
    ]


def get_api_key() -> str | None:
    key = os.environ.get("TOMTOM_API_KEY", "").strip()
    if key:
        return key
    env_path = Path(".env")
    if env_path.exists():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() == "TOMTOM_API_KEY":
                return value.strip().strip('"').strip("'") or None
    return None
