"""
storage.py — Hybrid storage system: Recent JSON (7 days) + Historical DuckDB archive.

Purpose:
- Keep recent 7 days as JSON for Git traceability
- Archive older data to DuckDB for space efficiency
- Seamless querying across both storage layers

Expected benefits:
- 80-90% reduction in git repo size
- Fast historical queries (DuckDB columnar storage)
- Maintains recent data visibility in Git
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

try:
    import duckdb
    DUCKDB_AVAILABLE = True
except ImportError:
    DUCKDB_AVAILABLE = False

logger = logging.getLogger(__name__)

# Configuration
ARCHIVE_DIR = Path(".archive")
DUCKDB_FILE = ARCHIVE_DIR / "traffic_history.duckdb"
RETENTION_DAYS = 7  # Keep recent N days as JSON


class HybridStorage:
    """
    Hybrid storage manager for traffic data.

    Recent data (< 7 days): JSON files in outputs/
    Historical data (>= 7 days): DuckDB database in .archive/
    """

    def __init__(self, db_path: Path | str | None = None):
        """
        Initialize hybrid storage.

        Args:
            db_path: Path to DuckDB file (default: .archive/traffic_history.duckdb)
        """
        if not DUCKDB_AVAILABLE:
            logger.warning("DuckDB not available, hybrid storage disabled")
            self.enabled = False
            return

        self.enabled = True
        self.db_path = Path(db_path) if db_path else DUCKDB_FILE
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Hybrid storage initialized: {self.db_path}")

    def archive_old_json_files(
        self,
        json_dir: Path,
        retention_days: int = RETENTION_DAYS,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """
        Archive JSON files older than retention_days to DuckDB.

        Args:
            json_dir: Directory containing JSON files
            retention_days: Keep files newer than this (default: 7 days)
            dry_run: If True, only report what would be archived

        Returns:
            dict with statistics (files_archived, bytes_saved, etc.)
        """
        if not self.enabled:
            return {"error": "DuckDB not available"}

        cutoff_date = datetime.now() - timedelta(days=retention_days)
        json_files = list(json_dir.glob("*.json"))

        stats = {
            "total_files": len(json_files),
            "archived_files": 0,
            "skipped_files": 0,
            "bytes_before": 0,
            "bytes_after": 0,
            "archived_sessions": [],
        }

        for json_file in json_files:
            # Get file modification time
            mtime = datetime.fromtimestamp(json_file.stat().st_mtime)

            if mtime >= cutoff_date:
                stats["skipped_files"] += 1
                continue

            # Archive this file
            try:
                file_size = json_file.stat().st_size
                stats["bytes_before"] += file_size

                if not dry_run:
                    # Read JSON
                    import json
                    with open(json_file) as f:
                        data = json.load(f)

                    # Determine table from filename
                    table_name = self._get_table_name(json_file.name)

                    # Insert into DuckDB
                    self._insert_to_duckdb(table_name, data, json_file.name)

                    # Delete JSON file
                    json_file.unlink()

                    logger.info(f"Archived: {json_file.name} → {table_name} ({file_size} bytes)")

                stats["archived_files"] += 1
                stats["archived_sessions"].append(json_file.name)

            except Exception as e:
                logger.error(f"Failed to archive {json_file.name}: {e}")
                continue

        stats["bytes_after"] = stats["bytes_before"] - sum(
            json_dir.glob("*.json").__sizeof__() for _ in range(stats["archived_files"])
        )
        stats["bytes_saved"] = stats["bytes_before"] - stats["bytes_after"]
        stats["compression_ratio"] = (
            stats["bytes_saved"] / stats["bytes_before"] if stats["bytes_before"] > 0 else 0
        )

        logger.info(
            f"Archive complete: {stats['archived_files']} files, "
            f"{stats['bytes_saved'] / 1024 / 1024:.2f} MB saved "
            f"({stats['compression_ratio']*100:.1f}% reduction)"
        )

        return stats

    def _get_table_name(self, filename: str) -> str:
        """
        Determine DuckDB table name from JSON filename.

        Examples:
            raw_measurements_S001.json → raw_measurements
            node_states_2024-08-28.json → node_states
            unified_traffic.json → unified_traffic
        """
        # Remove extension
        name = filename.replace(".json", "")

        # Remove session/date suffixes
        for suffix in ["_S", "_2024", "_2025", "_2026"]:
            if suffix in name:
                name = name.split(suffix)[0]
                break

        return name

    def _insert_to_duckdb(self, table_name: str, data: Any, source_file: str):
        """
        Insert JSON data into DuckDB table.

        Args:
            table_name: Name of the table
            data: JSON data (dict or list)
            source_file: Original filename (for metadata)
        """
        conn = duckdb.connect(str(self.db_path))

        try:
            # Convert to DataFrame
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                # Single record or nested structure
                if all(isinstance(v, (list, dict)) for v in data.values()):
                    # Nested dict → flatten
                    records = []
                    for key, value in data.items():
                        if isinstance(value, dict):
                            records.append({**value, "_key": key})
                        else:
                            records.append({"_key": key, "value": value})
                    df = pd.DataFrame(records)
                else:
                    # Single record
                    df = pd.DataFrame([data])
            else:
                logger.warning(f"Unsupported data type for {table_name}: {type(data)}")
                return

            if df.empty:
                logger.warning(f"No data to insert for {table_name} from {source_file}")
                return

            # Add metadata columns
            df["_archived_at"] = datetime.now()
            df["_source_file"] = source_file

            # Create table if not exists and insert
            conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} AS SELECT * FROM df WHERE 1=0")
            conn.execute(f"INSERT INTO {table_name} SELECT * FROM df")

            logger.debug(f"Inserted {len(df)} rows into {table_name}")

        except Exception as e:
            logger.error(f"DuckDB insert error for {table_name}: {e}")
            raise
        finally:
            conn.close()

    def query(self, sql: str) -> pd.DataFrame:
        """
        Execute SQL query on DuckDB archive.

        Args:
            sql: SQL query string

        Returns:
            pandas DataFrame with results
        """
        if not self.enabled:
            raise RuntimeError("DuckDB not available")

        conn = duckdb.connect(str(self.db_path))
        try:
            result = conn.execute(sql).fetchdf()
            return result
        finally:
            conn.close()

    def get_archive_stats(self) -> dict[str, Any]:
        """
        Get statistics about archived data.

        Returns:
            dict with table sizes, row counts, date ranges
        """
        if not self.enabled:
            return {"error": "DuckDB not available"}

        if not self.db_path.exists():
            return {"db_exists": False, "db_path": str(self.db_path)}

        conn = duckdb.connect(str(self.db_path))
        try:
            # Get all tables
            tables = conn.execute("SHOW TABLES").fetchdf()

            stats = {
                "db_path": str(self.db_path),
                "db_size_mb": self.db_path.stat().st_size / 1024 / 1024,
                "tables": {},
            }

            for table_name in tables["name"]:
                # Row count
                row_count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

                # Date range (if _archived_at exists)
                try:
                    date_range = conn.execute(
                        f"SELECT MIN(_archived_at), MAX(_archived_at) FROM {table_name}"
                    ).fetchone()
                    min_date, max_date = date_range
                except:
                    min_date, max_date = None, None

                stats["tables"][table_name] = {
                    "rows": row_count,
                    "min_date": str(min_date) if min_date else None,
                    "max_date": str(max_date) if max_date else None,
                }

            return stats

        finally:
            conn.close()


def create_storage(db_path: Path | str | None = None) -> HybridStorage:
    """
    Factory function to create HybridStorage instance.

    Args:
        db_path: Optional custom path to DuckDB file

    Returns:
        HybridStorage instance
    """
    return HybridStorage(db_path)


# CLI for manual archival
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Archive old JSON files to DuckDB")
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path("outputs"),
        help="Directory containing JSON files",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=RETENTION_DAYS,
        help=f"Keep files newer than this (default: {RETENTION_DAYS})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be archived without doing it",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show archive statistics",
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    storage = create_storage()

    if args.stats:
        stats = storage.get_archive_stats()
        print("\nArchive Statistics:")
        print("=" * 60)
        for key, value in stats.items():
            print(f"{key}: {value}")
        print("=" * 60)
    else:
        print(f"\nArchiving files from {args.dir}")
        print(f"Retention: {args.retention_days} days")
        print(f"Dry run: {args.dry_run}\n")

        result = storage.archive_old_json_files(
            args.dir,
            retention_days=args.retention_days,
            dry_run=args.dry_run,
        )

        print("\nArchival Results:")
        print("=" * 60)
        for key, value in result.items():
            if key != "archived_sessions":
                print(f"{key}: {value}")
        print("=" * 60)
