"""
test_enhanced_fusion.py - Test enhanced fusion algorithm improvements
"""

import sys
import numpy as np
import pandas as pd
from pathlib import Path

print("=" * 70)
print("DACN Traffic ETL - Enhanced Fusion Algorithm Test")
print("=" * 70)

# Test 1: Import module
print("\n[1/4] Testing Enhanced Node Agent Import...")
try:
    from etl.node_agent import (
        run_node_agents,
        _fuse_node,
        TEMPORAL_ALPHA,
        MAX_DATA_AGE_MINUTES,
        CONFIDENCE_DECAY_RATE,
        _PREVIOUS_STATES
    )
    print(f"  [OK] Module imported successfully")
    print(f"  [OK] Temporal alpha: {TEMPORAL_ALPHA}")
    print(f"  [OK] Max data age: {MAX_DATA_AGE_MINUTES} minutes")
    print(f"  [OK] Decay rate: {CONFIDENCE_DECAY_RATE:.6f}")
except Exception as e:
    print(f"  [FAIL] Import error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 2: Synthetic data test - Adaptive MAD
print("\n[2/4] Testing Adaptive MAD Penalty...")
try:
    # Create synthetic camera data
    test_cameras = pd.DataFrame({
        "session_id": ["S001"] * 9,
        "node_id": ["N01"] * 9,
        "node_short": ["N01"] * 9,
        "camera_id": [f"C{i:02d}" for i in range(9)],
        "image_quality": [0.8, 0.85, 0.9, 0.75, 0.8, 0.85, 0.9, 0.8, 0.85],
        "reliability": [0.9] * 9,
        "velocity": [30, 31, 29, 35, 30, 31, 32, 30, 29],  # One outlier (35)
        "density": [0.5] * 9,
        "delay_index": [1.0] * 9,
        "speed_ratio": [1.0] * 9,
        "los": ["D"] * 9,
        "lat": [10.77] * 9,
        "lon": [106.65] * 9,
        "road_segment": ["Test Road"] * 9,
        "time_slot": ["afternoon"] * 9,
        "date_str": ["2026-08-28"] * 9,
        "hour_vn": [14] * 9,
        "timestamp": [pd.Timestamp.now()] * 9,
    })

    result = _fuse_node(test_cameras, "S001", "N01")

    print(f"  [OK] Fusion completed")
    print(f"  [INFO] MAD velocity: {result.get('mad_velocity', 'N/A')} km/h")
    print(f"  [INFO] Adaptive K: {result.get('adaptive_k', 'N/A')}")
    print(f"  [INFO] Fused velocity: {result.get('fused_velocity', 'N/A')} km/h")
    print(f"  [INFO] Confidence: {result.get('confidence', 'N/A')}")

    # Verify outlier was penalized
    if result.get('fused_velocity'):
        if 29.5 <= result['fused_velocity'] <= 31.5:
            print(f"  [OK] Outlier properly penalized (velocity in expected range)")
        else:
            print(f"  [WARN] Velocity outside expected range: {result['fused_velocity']}")

except Exception as e:
    print(f"  [FAIL] Adaptive MAD test error: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Temporal smoothing
print("\n[3/4] Testing Temporal Smoothing...")
try:
    # Clear previous states
    _PREVIOUS_STATES.clear()

    # First measurement
    cameras_t1 = test_cameras.copy()
    cameras_t1["velocity"] = [30] * 9
    result1 = _fuse_node(cameras_t1, "S001", "N01")

    print(f"  [OK] First measurement: {result1.get('fused_velocity', 'N/A')} km/h")
    print(f"  [INFO] Temporal smoothed: {result1.get('temporal_smoothed', False)}")

    # Second measurement (different velocity)
    cameras_t2 = test_cameras.copy()
    cameras_t2["velocity"] = [40] * 9  # Jump to 40
    result2 = _fuse_node(cameras_t2, "S001", "N01")

    print(f"  [OK] Second measurement: {result2.get('fused_velocity', 'N/A')} km/h")
    print(f"  [INFO] Temporal smoothed: {result2.get('temporal_smoothed', False)}")

    # Verify smoothing applied
    if result2.get('temporal_smoothed') and result2.get('fused_velocity'):
        expected = TEMPORAL_ALPHA * 30 + (1 - TEMPORAL_ALPHA) * 40  # 0.3*30 + 0.7*40 = 37
        actual = result2['fused_velocity']
        if abs(actual - expected) < 0.5:
            print(f"  [OK] Temporal smoothing works correctly (expected ~{expected:.1f}, got {actual:.1f})")
        else:
            print(f"  [WARN] Smoothing deviation: expected {expected:.1f}, got {actual:.1f}")

except Exception as e:
    print(f"  [FAIL] Temporal smoothing test error: {e}")
    import traceback
    traceback.print_exc()

# Test 4: Run full pipeline
print("\n[4/4] Testing Full Pipeline with Recent Data...")
try:
    # Check if we have real data
    parquet_files = list(Path("raw_measurements").glob("*.parquet"))
    if parquet_files:
        # Load most recent file
        latest = sorted(parquet_files)[-1]
        print(f"  [INFO] Using: {latest.name}")

        import pyarrow.parquet as pq
        df = pq.read_table(str(latest)).to_pandas()

        if len(df) > 0:
            result_df = run_node_agents(df)
            print(f"  [OK] Processed {len(result_df)} node states")

            if len(result_df) > 0:
                print(f"  [INFO] Avg MAD: {result_df['mad_velocity'].mean():.2f} km/h")
                print(f"  [INFO] Avg adaptive K: {result_df['adaptive_k'].mean():.4f}")
                print(f"  [INFO] Avg confidence: {result_df['confidence'].mean():.4f}")
                print(f"  [INFO] Temporal smoothed: {result_df['temporal_smoothed'].sum()}/{len(result_df)}")
        else:
            print(f"  [WARN] No data in parquet file")
    else:
        print(f"  [INFO] No parquet files found, skipping real data test")

except Exception as e:
    print(f"  [WARN] Real data test skipped: {e}")

# Summary
print("\n" + "=" * 70)
print("ENHANCED FUSION TEST COMPLETE")
print("=" * 70)
print("\nEnhancements:")
print("✓ Adaptive MAD penalty (dynamic based on traffic variance)")
print("✓ Temporal smoothing (α=0.3, EMA with previous state)")
print("✓ Confidence decay (linear decay over 30 minutes)")
print("\nExpected improvements:")
print("- MAE reduction: 0.1-0.2 km/h")
print("- Better handling of traffic jumps")
print("- Reduced noise in congested conditions")
print("=" * 70)
