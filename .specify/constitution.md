# DACN-Traffic-ETL Constitution

## 1. Data-source boundary

This project operates on **TomTom Traffic Flow API virtual segment sensors** joined with **OpenStreetMap topology**. Changes must not introduce a supported runtime path that depends on physical cameras, uploaded videos, or camera hardware.

## 2. Geographic model

The operational network is the repository's configured node set in `config/nodes.yaml`. Changes must preserve compatibility with the current **22-node** topology unless the spec explicitly includes a network change.

## 3. Automation cadence

The intended automation model is a **24/7 continuous pipeline** with a **5-minute collection interval**. Changes affecting scheduling, workflows, or collection windows must keep ETL, exported outputs, and operational documentation in sync.

## 4. ETL correctness

Changes to extraction, transformation, fusion, or export must preserve the repository's expected ETL contract:

- raw measurement artifacts remain traceable
- ETL outputs remain machine-readable
- dashboard-facing JSON outputs remain consistent with generated parquet/summary outputs
- source lineage and collection metadata remain explicit

## 5. Node and dashboard consistency

Any change touching node identifiers, aggregation logic, output schemas, or dashboard-facing files must be wired across all impacted layers:

- config
- ETL transforms
- fusion logic
- export scripts
- dashboard data consumers
- automation workflows
- documentation

## 6. Spec-first changes

For any non-trivial feature, behavior change, or workflow change:

1. define the requested outcome in a feature spec
2. write a technical plan
3. break the work into ordered tasks
4. only then implement

Small tactical fixes may skip a full spec only when the behavior is already unambiguous.

## 7. Verification discipline

Every change must be validated with the smallest available targeted command that proves the modified path still works. If validation cannot run because the environment is missing tooling, the limitation must be stated explicitly in the final handoff.
