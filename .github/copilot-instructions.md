# GITHUB COPILOT CUSTOM INSTRUCTIONS FOR DACN-TRAFFIC-ETL

This workspace contains the **DACN-Traffic-ETL** Python data collection and preprocessing pipeline for Urban Traffic Estimation & Monitoring in Ho Chi Minh City.

## 🎯 CORE CONSTRAINTS & SYSTEM CONTEXT

1. **NO PHYSICAL CAMERAS / NO VIDEOS**:
   - This project strictly DOES NOT use physical cameras or video feeds.
   - All data originates from TomTom Traffic Flow API virtual segment sensors joined with OpenStreetMap (OSM) edge topology via KDTree.
   - Never generate code referencing physical camera feeds, video processing, or camera hardware.

2. **GEOGRAPHICAL SCOPE & 10 NODE AGENTS**:
   - Coverage: 100% District 10 (Quận 10) & Tân Bình main arterial corridors.
   - Node Agent IDs:
     - `N01_LY_THUONG_KIET`: Lý Thường Kiệt
     - `N02_BA_THANG_HAI`: Ba Tháng Hai (District 10)
     - `N03_CMT8`: Cách Mạng Tháng Tám (District 10)
     - `N04_THANH_THAI`: Thành Thái (District 10)
     - `N05_TO_HIEN_THANH`: Tô Hiến Thành (District 10)
     - `N06_NGUYEN_TRI_PHUONG`: Nguyễn Tri Phương (District 10)
     - `N07_SU_VAN_HANH`: Sư Vạn Hạnh (District 10)
     - `N08_DIEN_BIEN_PHU`: Điện Biên Phủ (District 10)
     - `N09_CONG_HOA`: Cộng Hòa (Tân Bình)
     - `N10_TRUONG_CHINH`: Trường Chinh (Tân Bình - Tân Phú)

3. **REAL-TIME 2-MINUTE CONTINUOUS STREAM**:
   - `config/etl.yaml` has `interval_minutes: 2` and `windows: 00:00-23:59`.
   - `auto_run.py` triggers continuous collection every 2 minutes 24/7 (`now.minute % 2 == 0`).

4. **ETL PIPELINE ALGORITHMS**:
   - Layer 1: KDTree spatial join (threshold <= 50m) + Hybrid 3-point Spatial Rolling Mean (Window=3) + 20% Consensus Median Shrinkage.
   - Layer 2: NodeAgent Fusion with MAD Outlier Penalty ($p_i = e^{-0.04 \cdot \text{dev}_i}$).
   - Layer 3: Central performance metrics (MAE, MAPE <= 15%, Density error <= 8%).
