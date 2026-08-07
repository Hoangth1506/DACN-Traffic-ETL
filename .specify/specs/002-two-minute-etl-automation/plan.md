# Two-minute ETL automation plan

## Scope

This work covers GitHub Actions workflow definitions, scheduler messaging in local automation, and cross-layer configuration consistency relevant to ETL cadence and dashboard export.

## Architecture / implementation notes

- Use `.github/workflows/etl_cron.yml` for raw collection scheduling
- Use `.github/workflows/traffic-etl.yml` for ETL generation and dashboard JSON export
- Keep Python dependency installation aligned with `requirements.txt`
- Keep dashboard output generation in `export_json.py`
- Keep the 22-node network untouched and compatible with current ETL/export scripts

## Risks

- Remote `main` may still be on legacy workflow files until the PR is merged
- Schedule changes without documentation updates can confuse operators

## Validation

- Inspect workflow YAML for cadence and steps
- Verify dashboard JSON output files exist in `dashboard/public/`
- Confirm branch diff contains the intended workflow changes
