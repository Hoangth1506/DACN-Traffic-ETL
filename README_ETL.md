# ETL hop nhat du lieu giao thong Non-IID

Pipeline nay thu thap va hop nhat du lieu giao thong cho 3 node bien:

- `N01_LY_THUONG_KIET`
- `N02_CONG_HOA`
- `N03_TRUONG_CHINH`

API key khong duoc ghi vao source. Truoc khi chay voi TomTom that, dat bien moi truong:

```powershell
$env:TOMTOM_API_KEY = "YOUR_TOMTOM_KEY"
python run_etl.py
```

Co the copy `.env.example` thanh `.env` tren may local va dien key vao `.env`. Khong commit file `.env` len GitHub.

Neu khong co `TOMTOM_API_KEY`, pipeline van chay bang `synthetic_fallback` de tao du lieu 7 ngay ban dau theo cac cua so:

- 06:00-08:00
- 11:00-13:00
- 16:00-19:00

## How to transform

1. Extract node center: toa do node bien duoc chon thu cong trong `config/nodes.yaml`.
2. Extract traffic: TomTom Flow Segment Data theo cac diem mau thu cong doc dung hanh lang tuyen duong trong `config/nodes.yaml`.
3. Extract topology: OSM Overpass lay road graph/way metadata quanh moi node.
4. Transform schema: chuan hoa ve `node_id`, `timestamp`, `lat/lon`, `velocity_kmph`, `free_flow_kmph`, `confidence`, `source_name`, `source_api`.
5. Transform metric:
   - `congestion_ratio = 1 - currentSpeed / freeFlowSpeed`
   - `density_proxy = congestion_ratio * 30`
   - `LOS` theo nguong van toc A-F trong paper.
6. Fusion:
   - `w = alpha * confidence + beta * recency + gamma * source_quality`
   - Chuan hoa `w` trong tung node.
   - Tinh `fused_velocity`, `fused_congestion_ratio`, `LOS`, `congestion_level`.
7. Load: xuat CSV/JSON va Parquet neu runtime co engine Parquet.

## Raw-only measurement workflow

Huong hien tai uu tien thu du lieu raw theo tung dot do thu cong. Tren GitHub:

```text
Actions -> Traffic ETL Raw Collection -> Run workflow
```

Nhap label, vi du:

```text
morning_06_27
noon_11_30
afternoon_17_15
```

Moi lan chay se tao thu muc rieng:

```text
outputs/raw_measurements/YYYY-MM-DD/HH-mm-ss_<measurement_label>/
```

Ben trong co:

```text
metadata.json
edge_nodes.json
tomtom_flow_records.json
osm_edges.json
tomtom_flow_<NODE_ID>_<SAMPLE_ID>.json
```

Index tich luy:

```text
outputs/raw_measurements/index.csv
outputs/raw_measurements/index.jsonl
```

Chay local:

```powershell
python run_raw_measurement.py --measurement-label test_manual
```

## Output ETL cu

Pipeline ghi ra 3 nhom output:

1. Snapshot moi nhat: `outputs/raw`, `outputs/processed`, `outputs/report`.
2. History khong ghi de: `outputs/history/YYYY-MM-DD/HH-mm-ss/`.
3. File tich luy: `outputs/processed/traffic_observations_all.csv` va `outputs/processed/node_fusion_all.csv`.

- `outputs/raw/tomtom_flow_records.json`: du lieu TomTom raw truoc transform.
- `outputs/raw/tomtom_flow_<NODE_ID>_<SAMPLE_ID>.json`: raw response rieng cho tung diem lay mau.
- `outputs/raw/`: raw JSON TomTom/OSM va `osm_edges.*`
- `outputs/processed/traffic_observations.*`: observation sau transform
- `outputs/processed/node_fusion.*`: ket qua fusion theo node
- `outputs/processed/node_fusion_all.csv`: ket qua fusion tich luy tat ca lan chay
- `outputs/processed/traffic_observations_all.csv`: observation tich luy tat ca lan chay
- `outputs/processed/non_iid_stats.*`: thong ke phan phoi theo node
- `outputs/processed/non_iid_tests.*`: KS distance va JS distance giua cac node
- `outputs/report/non_iid_etl_report.docx`
- `outputs/report/non_iid_etl_report.pdf`
- `outputs/report/charts/*.svg`

## PyTorch object detection, velocity, and flow

De chay AI tren video MP4 bang PyTorch/YOLO:

```powershell
python -m pip install -r requirements.txt
python run_video_ai.py
python run_etl.py
```

`run_video_ai.py` doc cau hinh tu `config/video_ai.json`, dung YOLO de nhan dien:

- `motorcycle`
- `car`
- `bus`
- `truck`

Ket qua duoc luu tai:

- `outputs/processed/video_ai_observations.csv`
- `outputs/processed/video_ai_observations.json`

Pipeline ETL se tu dong nap file `video_ai_observations.csv` neu file nay ton tai, roi dua nguon `pytorch_yolo_video` vao hop nhat node. Cong thuc AI:

- Van toc tung track: `v = distance_pixel * meters_per_pixel / delta_time * 3.6`
- Luu luong: `flow_rate = line_crossing_count / duration_seconds * 60`
- Mat do proxy: `density_proxy = equivalent_vehicle_count / processed_frames`

Muon van toc chinh xac hon, can hieu chinh `meters_per_pixel` trong `config/video_ai.json` theo camera that hoac homography mat duong.

## GitHub automatic collection

Workflow `.github/workflows/traffic-etl.yml` chay moi 30 phut trong cac khung gio Viet Nam da cau hinh. Tren GitHub, tao repository secret:

```text
TOMTOM_API_KEY
```

Workflow dung `${{ secrets.TOMTOM_API_KEY }}` va commit output vao thu muc `outputs/`. Cau hinh hien tai phu hop giai doan tich luy 3 thang; sau 3 thang co the tat workflow hoac chuyen sang lich khac.
