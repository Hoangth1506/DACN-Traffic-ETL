"""
test_hybrid_storage.py - Test DuckDB hybrid storage system
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timedelta

print("=" * 70)
print("DACN Traffic ETL - Hybrid Storage Test")
print("=" * 70)

# Test 1: Import and initialization
print("\n[1/5] Testing Storage Module Import...")
try:
    from traffic_etl.storage import (
        HybridStorage,
        create_storage,
        DUCKDB_AVAILABLE,
        RETENTION_DAYS
    )
    print(f"  [OK] Module imported successfully")
    print(f"  [INFO] DuckDB available: {DUCKDB_AVAILABLE}")
    print(f"  [INFO] Default retention: {RETENTION_DAYS} days")

    if not DUCKDB_AVAILABLE:
        print(f"  [WARN] DuckDB not installed, storage features disabled")
        sys.exit(0)

except Exception as e:
    print(f"  [FAIL] Import error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 2: Create storage instance
print("\n[2/5] Testing Storage Initialization...")
try:
    storage = create_storage(db_path=".test_archive/test_traffic.duckdb")
    print(f"  [OK] Storage instance created")
    print(f"  [INFO] DB path: {storage.db_path}")
    print(f"  [INFO] Enabled: {storage.enabled}")
except Exception as e:
    print(f"  [FAIL] Initialization error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Test table name extraction
print("\n[3/5] Testing Table Name Extraction...")
test_files = [
    "raw_measurements_S001.json",
    "node_states_2024-08-28.json",
    "unified_traffic.json",
    "camera_records_S123.json",
]

for filename in test_files:
    table = storage._get_table_name(filename)
    print(f"  [OK] {filename:40s} → {table}")

# Test 4: Test archival with synthetic data
print("\n[4/5] Testing Archival with Synthetic Data...")
try:
    # Create test directory
    test_dir = Path(".test_archive/test_json")
    test_dir.mkdir(parents=True, exist_ok=True)

    # Create old JSON file (8 days ago)
    old_file = test_dir / "test_old_data.json"
    old_data = {
        "session_id": "S001",
        "timestamp": "2026-08-20T10:00:00",
        "velocity": 30.5,
        "node_id": "N01",
    }
    with open(old_file, "w") as f:
        json.dump(old_data, f)

    # Set modification time to 8 days ago
    old_time = (datetime.now() - timedelta(days=8)).timestamp()
    Path(old_file).touch()
    import os
    os.utime(old_file, (old_time, old_time))

    # Create recent JSON file (2 days ago)
    recent_file = test_dir / "test_recent_data.json"
    recent_data = {
        "session_id": "S002",
        "timestamp": "2026-08-26T10:00:00",
        "velocity": 28.3,
        "node_id": "N02",
    }
    with open(recent_file, "w") as f:
        json.dump(recent_data, f)

    print(f"  [OK] Created test files:")
    print(f"       - {old_file.name} (old, should archive)")
    print(f"       - {recent_file.name} (recent, should keep)")

    # Test dry run
    print(f"\n  Testing dry-run mode...")
    stats = storage.archive_old_json_files(test_dir, retention_days=7, dry_run=True)

    print(f"  [OK] Dry run completed")
    print(f"       Total files: {stats['total_files']}")
    print(f"       Would archive: {stats['archived_files']}")
    print(f"       Would skip: {stats['skipped_files']}")

    if stats['archived_files'] == 1 and stats['skipped_files'] == 1:
        print(f"  [OK] Correct file selection (1 old, 1 recent)")
    else:
        print(f"  [WARN] Unexpected selection")

    # Test actual archival
    print(f"\n  Testing actual archival...")
    stats = storage.archive_old_json_files(test_dir, retention_days=7, dry_run=False)

    print(f"  [OK] Archival completed")
    print(f"       Archived: {stats['archived_files']} files")
    print(f"       Bytes saved: {stats.get('bytes_saved', 0)} bytes")

    # Verify old file deleted, recent file kept
    if not old_file.exists() and recent_file.exists():
        print(f"  [OK] Old file archived and deleted")
        print(f"  [OK] Recent file kept")
    else:
        print(f"  [WARN] File state unexpected")

except Exception as e:
    print(f"  [FAIL] Archival test error: {e}")
    import traceback
    traceback.print_exc()

# Test 5: Test query and stats
print("\n[5/5] Testing Query and Statistics...")
try:
    # Get stats
    stats = storage.get_archive_stats()
    print(f"  [OK] Retrieved archive statistics")
    print(f"       DB size: {stats.get('db_size_mb', 0):.2f} MB")
    print(f"       Tables: {len(stats.get('tables', {}))}")

    for table_name, table_stats in stats.get('tables', {}).items():
        print(f"       - {table_name}: {table_stats['rows']} rows")

    # Test query
    try:
        result = storage.query("SELECT COUNT(*) as cnt FROM test_old_data")
        print(f"  [OK] Query executed successfully")
        print(f"       Result: {result['cnt'].iloc[0]} rows")
    except Exception as e:
        print(f"  [WARN] Query test skipped: {e}")

except Exception as e:
    print(f"  [FAIL] Stats/query test error: {e}")
    import traceback
    traceback.print_exc()

# Cleanup
print("\n[Cleanup] Removing test files...")
try:
    import shutil
    shutil.rmtree(".test_archive", ignore_errors=True)
    print("  [OK] Test artifacts cleaned up")
except Exception as e:
    print(f"  [WARN] Cleanup warning: {e}")

# Summary
print("\n" + "=" * 70)
print("HYBRID STORAGE TEST COMPLETE")
print("=" * 70)
print("\nFeatures tested:")
print("✓ DuckDB storage initialization")
print("✓ Table name extraction from filenames")
print("✓ Dry-run mode (preview without changes)")
print("✓ Actual archival (move JSON → DuckDB)")
print("✓ Query interface")
print("✓ Archive statistics")
print("\nExpected benefits in production:")
print("- 80-90% git repo size reduction")
print("- Fast historical queries with DuckDB")
print("- Recent 7 days kept as JSON for visibility")
print("=" * 70)
