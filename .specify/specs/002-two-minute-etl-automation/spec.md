# Two-minute ETL automation

## Why

The repository's intended operating model is a 24/7 traffic ETL pipeline. The automation path must continuously collect raw data, run ETL, and export dashboard JSON on the same cadence so the dashboard reflects fresh processed data.

## Desired outcome

Automation on `main` runs every 5 minutes, raw collection remains traceable, ETL artifacts are regenerated, and dashboard JSON outputs are refreshed from the latest ETL outputs.

## Requirements

1. GitHub Actions must schedule raw collection on a 5-minute interval.
2. GitHub Actions must run ETL and dashboard JSON export on a 5-minute interval or equivalent end-to-end automated trigger.
3. Automation must not rely on unsupported camera/video inputs.
4. Dashboard JSON exports must remain generated from ETL outputs committed by automation.
5. The automation path must remain compatible with the current 22-node configuration.

## Constraints

- Respect `.specify/constitution.md`
- Preserve repository-local ETL scripts rather than introducing unrelated infrastructure
- Keep source-of-truth schedules and docs aligned

## Acceptance signals

- Workflow files declare 5-minute schedules
- ETL workflow runs raw collection, ETL generation, and JSON export
- Dashboard public JSON files are part of the automated output path
