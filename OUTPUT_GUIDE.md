# Giai thich output ETL giao thong

## 1. File tong ket chinh

File nen xem dau tien la:

```text
outputs/processed/main_summary.json
```

File nay gom:

- `run_id`: ma lan chay, dang `YYYYMMDDTHHMMSSZ`.
- `run_started_at`: thoi diem bat dau lan chay.
- `generated_at`: thoi diem tao output.
- `is_official_collection_window`: `true` neu lan chay nam trong khung gio chinh thuc, `false` neu la lan test thu cong ngoai khung.
- `collection_type`: `official_collection_window` hoac `manual_test_outside_official_windows`.
- `collection_windows`: cac khung gio hop le de thu thap du lieu: `06:00-08:00`, `11:00-13:00`, `16:00-19:00`.
- `tomtom_mode`: che do du lieu TomTom, vi du `live_current_flow` neu dang lay API that.
- `data_readiness_note`: ghi ro du lieu hien tai la TomTom live hay synthetic fallback/backfill de test pipeline.
- `has_video_ai_output`: `true` neu da co ket qua PyTorch/YOLO tu video, `false` neu chua co.
- `main_result_file`: file ket qua hop nhat node.
- `detailed_observation_file`: file chi tiet tung observation.
- `history_dir`: thu muc luu ban sao rieng cua lan chay, khong ghi de lan chay cu.
- `append_files`: cac file tich luy tat ca lan chay.
- `video_ai_file`: file AI video neu da chay `run_video_ai.py`.
- `node_fusion`: ket qua hop nhat cuoi cung cua 3 node.
- `non_iid_stats`: thong ke phan phoi velocity theo node.
- `non_iid_tests`: KS distance va JS distance de minh chung Non-IID.
- `lineage`: nguon goc du lieu.

## 2. Cac file output quan trong

Co 3 nhom output:

1. Snapshot moi nhat trong `outputs/raw`, `outputs/processed`, `outputs/report`.
2. History khong ghi de trong `outputs/history/YYYY-MM-DD/HH-mm-ss/`.
3. File tich luy trong `outputs/processed/*_all.csv` va `outputs/processed/*_all.jsonl`.

Neu chay GitHub Actions 3 thang, nen dung nhom 2 hoac 3 de phan tich du lieu dai han. Snapshot chi de xem nhanh lan chay moi nhat.

### `outputs/raw/tomtom_flow_records.json`

Du lieu raw lay tu TomTom Traffic Flow Segment Data API. Day la du lieu truoc transform, dung de chung minh nguon goc du lieu.

Ngoai file tong hop nay, moi diem lay mau TomTom raw con co file rieng:

```text
outputs/raw/tomtom_flow_<NODE_ID>_<SAMPLE_ID>.json
```

Vi du:

```text
outputs/raw/tomtom_flow_N01_LY_THUONG_KIET_0.json
```

Day la noi xem du lieu tho truoc khi bien doi thanh `traffic_observations`.

### `outputs/raw/geocoded_nodes.json`

Toa do 3 node bien lay thu cong tu `config/nodes.yaml`. Ten file nay duoc giu de tuong thich voi pipeline cu.

### `outputs/raw/edge_nodes.json`

Ban sao ro nghia hon cua `geocoded_nodes.json`, dung de the hien 3 node bien da duoc chon thu cong:

- `N01_LY_THUONG_KIET`
- `N02_CONG_HOA`
- `N03_TRUONG_CHINH`

### `outputs/raw/osm_edges.json`

Road graph/road segment lay tu OSM Overpass quanh moi node. File nay dung de minh chung topology duong va nguon OSM.

### `outputs/processed/traffic_observations.json`

File chi tiet sau transform. Moi dong la mot diem mau traffic quanh node.

### `outputs/processed/node_fusion.json`

File ket qua chinh sau hop nhat co trong so. Moi dong la ket qua cuoi cung cua mot node.

### `outputs/processed/node_fusion_all.csv`

File tich luy ket qua hop nhat cua tat ca lan chay. Moi dong co them:

- `run_id`
- `run_started_at`
- `is_official_collection_window`
- `collection_type`

### `outputs/processed/traffic_observations_all.csv`

File tich luy chi tiet tat ca observation cua moi lan chay.

### `outputs/history/YYYY-MM-DD/HH-mm-ss/`

Thu muc luu rieng tung lan chay. Vi du:

```text
outputs/history/2026-04-27/06-00-00/node_fusion.json
outputs/history/2026-04-27/06-00-00/traffic_observations.json
```

### `outputs/processed/video_ai_observations.json`

File nay chi xuat hien sau khi chay:

```powershell
python run_video_ai.py
```

No chua ton tai neu may chua cai `torch`, `opencv-python`, `ultralytics` hoac chua chay AI video.

## 3. Giai thich bien trong `traffic_observations`

- `node_id`: ma node bien.
- `node_name`: ten node.
- `sample_id`: thu tu diem mau quanh node.
- `lat`, `lon`: toa do diem mau.
- `sampling_method`: cach lay mau, hien nen la `manual_corridor` cho cac diem doc dung tuyen.
- `target_road_names`: ten tuyen muc tieu dung de giai thich nguon goc diem lay mau.
- `velocity_kmph`: van toc hien tai, don vi km/h.
- `free_flow_kmph`: van toc khi duong thong thoang, don vi km/h.
- `current_travel_time`: thoi gian di chuyen hien tai tren segment TomTom.
- `free_flow_travel_time`: thoi gian di chuyen khi thong thoang.
- `confidence`: do tin cay cua nguon du lieu, trong khoang 0-1.
- `recency_score`: diem moi cua du lieu, cang gan luc chay ETL thi cang cao.
- `source_quality`: trong so chat luong nguon, vi du TomTom cao hon synthetic fallback.
- `congestion_ratio`: ty le tac duong, tinh bang `1 - velocity_kmph/free_flow_kmph`.
- `density_proxy`: proxy mat do, tinh bang `congestion_ratio * 30`.
- `los`: Level of Service theo van toc, gom A/B/C/D/E/F.
- `congestion_level`: nhan muc do giao thong: `thoang`, `trung_binh`, `dong`, `un_tac`, `closed`.
- `road_closure`: duong co bi dong hay khong.
- `source_name`: ten nguon, vi du `tomtom_flow`, `pytorch_yolo_video`, `synthetic_fallback`.
- `source_api`: API/thu vien tao ra du lieu.
- `raw_path`: duong dan file raw dung de truy vet.
- `extract_error`: loi khi extract neu co.
- `extracted_at`: thoi diem lay du lieu.

## 4. Giai thich bien trong `node_fusion`

- `node_id`: ma node.
- `node_name`: ten node.
- `status`: trang thai hop nhat, `ok` neu du du lieu.
- `fused_velocity`: van toc trung binh sau hop nhat co trong so.
- `fused_congestion_ratio`: ty le tac duong sau hop nhat.
- `los`: LOS sau hop nhat.
- `congestion_level`: muc un tac sau hop nhat.
- `confidence`: do tin cay trung binh sau hop nhat.
- `observation_count`: so observation/sample records tham gia hop nhat.
- `weight_sum`: tong trong so sau chuan hoa, dung ky vong la `1.0`.

Cong thuc hop nhat:

```text
w = alpha * confidence + beta * recency_score + gamma * source_quality
fused_velocity = sum(normalized_w_i * velocity_i)
fused_congestion_ratio = sum(normalized_w_i * congestion_ratio_i)
```

Mac dinh:

```text
alpha = 0.5
beta  = 0.3
gamma = 0.2
```

## 5. Giai thich output AI video

Sau khi cai thu vien va chay `run_video_ai.py`, file `video_ai_observations.json` se co cac bien:

- `motorcycle_count`, `car_count`, `bus_count`, `truck_count`: so doi tuong YOLO nhan dien theo tung loai.
- `equivalent_vehicle_count`: so xe quy doi, voi xe may=1, oto=4, bus=16, truck=16.
- `line_crossing_flow_count`: so xe cat qua vach ao.
- `flow_rate_vehicles_per_min`: luu luong xe/phut.
- `velocity_kmph`: van toc trung binh uoc luong tu tracking.
- `density_proxy`: mat do proxy tu so xe quy doi / so frame xu ly.
- `model`: model YOLO dang dung.
- `device`: `cuda` neu co GPU, nguoc lai la `cpu`.

Luu y: van toc tu video chi chinh xac khi `meters_per_pixel` trong `config/video_ai.json` duoc hieu chinh theo camera that hoac homography mat duong.

## 6. Output hien tai co du de lam gi?

Hien tai da du de:

- Tinh van toc trung binh theo node tu TomTom: dung `outputs/processed/node_fusion.json`.
- Tinh muc un tac/LOS/congestion ratio.
- Chung minh nguon goc du lieu va Non-IID theo 3 node.

Neu `tomtom_mode = synthetic_initial_history_fallback`, day chi la du lieu test/backfill mo phong de kiem tra pipeline ETL, khong phai du lieu TomTom live that. Chi xem la du lieu that khi `tomtom_mode = live_current_flow`.

Hien tai chua du de:

- Ket luan nhan dien doi tuong that tu video.
- Tinh luu luong that tu video.

Ly do: chua co file `outputs/processed/video_ai_observations.json`. Can cai PyTorch/OpenCV/Ultralytics va chay `run_video_ai.py`.

## 7. Co nen don dep du lieu lay luc 0h10 sang khong?

Nen don dep hoac danh dau rieng neu do la lan chay thu cong ngoai khung gio nghien cuu. Khung gio dung cua de tai la:

```text
06:00-08:00
11:00-13:00
16:00-19:00
```

Lan chay luc 0h10 sang khong thuoc khung gio tren, nen khong nen dua vao tap du lieu chinh de bao cao ket qua giao thong theo khung gio. Co 2 cach xu ly:

1. Xoa output 0h10 va chay lai trong dung khung gio.
2. Giu lai lam test run, nhung ghi ro `manual_test_outside_window`, khong tinh vao thong ke chinh.

Khi chay tu dong tren GitHub Actions, workflow da co `--respect-windows`, nen se bo qua cac lan chay ngoai khung gio.

Nen xoa cac thu muc output sinh ngoai gio neu muon tap du lieu sach:

```text
outputs/raw
outputs/processed
outputs/report
```

Sau do chay lai trong khung gio chinh thuc hoac de GitHub Actions tu dong thu thap.
