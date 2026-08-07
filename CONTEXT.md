# Shared Language for DACN-Traffic-ETL

This document defines the repository's **shared language** so humans and coding agents use the same terms when discussing ETL, automation, fusion, and dashboard work.

## Core boundaries

- **TomTom virtual segment sensors**: the supported traffic source. These are API-derived segment observations, not physical sensors.
- **OSM topology**: OpenStreetMap road geometry and metadata used for spatial matching.
- **No physical camera / no video runtime path**: the supported project path does not depend on physical cameras, video uploads, or camera hardware.

## Geography

- **22-node network**: the active operational network defined in `config/nodes.yaml`.
- **Node**: a monitored corridor or road segment anchor identified by `node_id` such as `N01_LY_THUONG_KIET`.
- **Sample point**: one virtual observation point along a node corridor.

## Data collection terms

- **Raw measurement**: one collection run produced by `run_raw_measurement.py`, stored under `outputs/raw_measurements/YYYY-MM-DD/HH-mm-ss_<label>/`.
- **Measurement label**: human-readable suffix such as `auto_cron` or `github_cron_live`.
- **Traceable raw artifacts**: `metadata.json`, `edge_nodes.json`, `tomtom_flow_records.json`, `osm_edges.json`, and per-sample raw JSON files.

## ETL pipeline terms

- **traffic_data.json**: dashboard-facing exported unified records.
- **camera_records.json**: legacy-compatible layer-1 export name. In this repository it represents virtual edge observation points, not physical cameras.
- **node_states.json**: fused layer-2 node state output from the NodeAgent stage.
- **performance_metrics.json**: layer-3 metrics output for quality/performance reporting.
- **unified_traffic.parquet**: consolidated ETL output before dashboard JSON export.

## Spatial and traffic metrics

- **osm_matched**: whether a traffic record was matched to OSM topology.
- **free_flow_speed**: expected uncongested speed from source data.
- **current_speed**: measured current speed from the data source or ETL-derived record.
- **congestion_index**: normalized congestion measure derived from free-flow vs current speed.
- **speed_ratio**: current speed divided by free-flow speed.
- **density**: layer-specific density-like signal; in some exports this is the renamed congestion-derived field.

## Fusion terms

- **NodeAgent Fusion**: the layer-2 aggregation stage that combines per-point observations into node-level state.
- **fused_velocity**: weighted node-level speed after fusion.
- **confidence**: trust score attached to an observation or fused state.
- **MAD outlier penalty**: the fusion penalty term used to down-weight deviant observations.

## LOS language

This repository uses **reversed LOS semantics** compared with many conventional traffic systems:

- **LOS A**: worst / severe congestion
- **LOS F**: best / free-flow traffic

When discussing LOS, always confirm you mean the repository's reversed scale.

## Automation language

- **5-minute cadence**: the intended automation interval for collection and ETL refresh.
- **Continuous 24/7 pipeline**: raw collection, ETL, and dashboard export are expected to keep data fresh around the clock.
- **Dashboard-facing JSON outputs**: files in `dashboard/public/` consumed directly by the frontend.

## Spec-driven language

- **Constitution**: the project rules in `.specify/constitution.md`.
- **Spec**: the feature-level statement of what and why.
- **Plan**: the implementation/architecture document for a feature.
- **Tasks**: ordered actionable work items tied to a feature.

## Preferred wording

Prefer these phrases:

- **virtual observation point** instead of "camera" when talking about system semantics
- **legacy-compatible field name** when `camera_id` or `camera_records` must be preserved for compatibility
- **22-node network** instead of older 10-node wording
- **5-minute realtime cadence** for the current automation model

Avoid these phrases unless discussing legacy compatibility:

- "physical camera"
- "video feed"
- "3-node network"
- "10-node network"
- "5-minute schedule"
