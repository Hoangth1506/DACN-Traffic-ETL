# Two-minute ETL automation tasks

## Setup

- [x] Review current workflow files and ETL/export entrypoints

## Foundational

- [x] Align raw collection workflow cadence to 5 minutes
- [x] Align ETL/export workflow cadence to 5 minutes
- [x] Ensure workflow dependency installation uses repository requirements

## Implementation

- [x] Wire ETL workflow to run raw collection, ETL generation, and dashboard JSON export
- [x] Ensure workflow outputs include dashboard-facing JSON artifacts
- [x] Keep unsupported video configuration out of the supported automation path
- [x] Keep node identifier handling compatible with the 22-node topology

## Validation

- [x] Inspect workflow YAML after edits
- [x] Confirm dashboard public JSON files exist locally

## Documentation

- [x] Update repository documentation to describe the spec-driven workflow and current 5-minute automation model
