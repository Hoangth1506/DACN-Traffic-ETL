from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class NodeConfig:
    node_id: str
    name: str
    query: str
    radius_m: int
    fallback_lat: float
    fallback_lon: float
    target_road_names: str = ""
    sample_points: str = ""


@dataclass(frozen=True)
class FusionConfig:
    alpha_confidence: float
    beta_recency: float
    gamma_source_quality: float


@dataclass(frozen=True)
class EtlConfig:
    sample_points_per_node: int
    sample_radius_m: int
    recency_window_minutes: int
    initial_history_days: int
    auto_collection_months: int
    timezone: str
    interval_minutes: int
    windows: list[str]
    fusion: FusionConfig
    source_quality: dict[str, float]
    base_dir: Path


def _coerce(value: str) -> Any:
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1]
    if value == "":
        return ""
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


def load_nodes(path: Path) -> list[NodeConfig]:
    """Parse the small YAML subset used by config/nodes.yaml."""
    nodes: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line == "nodes:":
            continue
        if line.startswith("- "):
            if current:
                nodes.append(current)
            current = {}
            line = line[2:].strip()
            if line:
                key, value = line.split(":", 1)
                current[key.strip()] = _coerce(value)
            continue
        if current is not None and ":" in line:
            key, value = line.split(":", 1)
            current[key.strip()] = _coerce(value)
    if current:
        nodes.append(current)
    return [NodeConfig(**node) for node in nodes]


def load_etl_config(path: Path) -> EtlConfig:
    sections: dict[str, dict[str, Any]] = {}
    section = ""
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        if not raw.startswith(" ") and raw.strip().endswith(":"):
            section = raw.strip()[:-1]
            sections[section] = {}
            continue
        if ":" in raw and section:
            key, value = raw.strip().split(":", 1)
            sections[section][key.strip()] = _coerce(value)

    sampling = sections["sampling"]
    collection = sections["collection"]
    fusion = sections["fusion"]
    sources = sections["sources"]
    outputs = sections["outputs"]
    return EtlConfig(
        sample_points_per_node=int(sampling["sample_points_per_node"]),
        sample_radius_m=int(sampling["sample_radius_m"]),
        recency_window_minutes=int(sampling["recency_window_minutes"]),
        initial_history_days=int(collection["initial_history_days"]),
        auto_collection_months=int(collection["auto_collection_months"]),
        timezone=str(collection["timezone"]),
        interval_minutes=int(collection["interval_minutes"]),
        windows=[w.strip() for w in str(collection["windows"]).split(",") if w.strip()],
        fusion=FusionConfig(
            alpha_confidence=float(fusion["alpha_confidence"]),
            beta_recency=float(fusion["beta_recency"]),
            gamma_source_quality=float(fusion["gamma_source_quality"]),
        ),
        source_quality={
            "tomtom_flow": float(sources["tomtom_quality"]),
            "osm_topology": float(sources["osm_quality"]),
            "synthetic_fallback": float(sources["synthetic_quality"]),
            "pytorch_yolo_video": float(sources["pytorch_yolo_quality"]),
        },
        base_dir=Path(str(outputs["base_dir"])),
    )
