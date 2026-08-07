# HỆ THỐNG GIÁM SÁT VÀ DỰ BÁO GIAO THÔNG THỜI GIAN THỰC (REAL-TIME 24/7)
## ĐỒ ÁN CHUYÊN NGÀNH 2026 — KIẾN TRÚC NODE-AGENT-EDGE ALL-IN-ONE

Hệ thống hợp nhất toàn bộ quy trình **Thu thập dữ liệu thô (ETL Backend)**, **Thuật toán Hợp nhất Dữ liệu (NodeAgent Fusion Engine)** và **Giao diện Giám sát Bản đồ GIS (React Vite Dashboard)** trong duy nhất Repository này.

---

## 🎯 1. ĐẶC ĐIỂM NỔI BẬT & RÀNG BUỘC HỆ THỐNG

1. **🛑 100% Không dùng Camera Vật lý / Không Video**:
   * Hệ thống vận hành hoàn toàn dựa trên cảm biến ảo từ **TomTom Traffic Flow API** kết hợp với mạng lưới hạ tầng đường bộ **OpenStreetMap (OSM)** thông qua giải thuật **KDTree Spatial Join** ($r \le 50\text{ m}$).
2. **📍 Mạng lưới 22 Node Agents (Bao trọn 100% Quận 10 & Tân Bình)**:
   * `N01_LY_THUONG_KIET`: Tuyến Lý Thường Kiệt (Q.10 - Tân Bình)
   * `N02_BA_THANG_HAI`: Nút Ba Tháng Hai (Quận 10)
   * `N03_CMT8`: Tuyến Cách Mạng Tháng Tám (Quận 10)
   * `N04_THANH_THAI`: Tuyến Thành Thái (Quận 10)
   * `N05_TO_HIEN_THANH`: Tuyến Tô Hiến Thành (Quận 10)
   * `N06_NGUYEN_TRI_PHUONG`: Tuyến Nguyễn Tri Phương (Quận 10)
   * `N07_SU_VAN_HANH`: Tuyến Sư Vạn Hạnh (Quận 10)
   * `N08_DIEN_BIEN_PHU`: Tuyến Điện Biên Phủ (Quận 10)
   * `N09_CONG_HOA`: Tuyến Cộng Hòa (Tân Bình)
   * `N10_TRUONG_CHINH`: Tuyến Trường Chinh (Tân Bình - Tân Phú)
3. **⚡ Tần suất Real-Time 5 phút/lần (24/7 Continuous Stream)**:
   * Loại bỏ hoàn toàn các khung giờ cắt giảm cũ. Dữ liệu được thu thập liên tục từ **`00:00` đến `23:59`**.
4. **📊 Chỉ số Chất lượng & Sai số Thực nghiệm**:
   * **Độ chính xác dữ liệu (Quality Score)**: **98.4%**
   * **Sai số tuyệt đối trung bình (MAE)**: **0.963 km/h**
   * **Sai số phần trăm (MAPE)**: **4.381%** (Vượt tiêu chuẩn <= 15%)

---

## 🏗️ 2. QUY TRÌNH HỢP NHẤT DỮ LIỆU (ETL PIPELINE 3 LỚP)

* **Lớp 1 (Edge Node Spatial Join)**:
  * Khớp nối tọa độ điểm đo TomTom với cách đoạn đường OSM trong bán kính 50m.
  * Lọc nhiễu bằng giải thuật Spatial Rolling Mean 3 điểm (Window=3) và co rút trung vị 20% (Consensus Median Shrinkage).
* **Lớp 2 (NodeAgent Fusion)**:
  * Hợp nhất vận tốc với trọng số phạt lệch MAD Outlier Penalty ($p_i = e^{-0.04 \cdot \text{dev}_i}$).
  * Xếp cấp độ dịch vụ **LOS đảo ngược**:
    * `LOS A`: $< 7\text{ km/h}$ (Ùn tắc nghiêm trọng)
    * `LOS B`: $< 13\text{ km/h}$
    * `LOS C`: $< 20\text{ km/h}$
    * `LOS D`: $< 30\text{ km/h}$
    * `LOS E`: $< 35\text{ km/h}$
    * `LOS F`: $\ge 35\text{ km/h}$ (Thông thoáng / Tốt nhất)
* **Lớp 3 (Central Metrics & Export)**:
  * Xuất file định dạngParquet nén 9.81x (`outputs/unified_traffic.parquet`, `node_states.parquet`).
  * Xuất các tệp JSON công khai phục vụ Web Dashboard (`dashboard/public/*.json`).

---

## 🚀 3. HƯỚNG DẪN VẬN HÀNH

### 🔹 Cách 1: Chạy Tự Động trên Máy Cá Nhân (Local 5 phút/lần)
Mở Terminal trong thư mục dự án và chạy:
```powershell
# 1. Kích hoạt bộ đếm tự động lấy dữ liệu liên tục 5 phút/lần
python auto_run.py

# 2. Khởi chạy Web Dashboard trực tiếp
cd dashboard
npm run dev
```
Trang web sẽ phát trực tiếp tại **`http://localhost:3000`**.

### 🔹 Cách 2: Tự Động Hóa 24/7 trên Đám Mây (GitHub Actions + Vercel)
Hệ thống cloud hiện được tách thành 2 workflow trên branch `main`:
1. **`.github/workflows/etl_cron.yml`**: thu thập dữ liệu thô TomTom/OSM mỗi **5 phút** và chỉ commit `outputs/raw_measurements/`.
2. **`.github/workflows/traffic-etl.yml`**: chạy ETL, export JSON dashboard và rebuild `dashboard/dist/` từ dữ liệu thô mới nhất.

Lưu ý vận hành hiện tại:

* Bước **auto-commit artifact ETL** trong `traffic-etl.yml` đang được **tắt tạm thời** để tránh tái diễn lỗi conflict trong `dashboard/public/*.json`.
* Vì vậy, nếu muốn **publish dashboard data mới lên Vercel**, cần đảm bảo commit `main` đã chứa bộ `dashboard/public/` và `dashboard/dist/` sạch trước khi Vercel redeploy.
* Vercel đang deploy từ thư mục **`dashboard/dist`** theo `vercel.json`.

Bạn có thể vào tab **`Actions`** trên GitHub $\rightarrow$ bấm **`Run workflow`** để chạy thu thập/ETL thủ công, và vào Vercel để **Redeploy** khi cần đẩy bản dashboard mới nhất lên production.

---

## 📁 4. CẤU TRÚC MÃ NGUỒN ALL-IN-ONE

```text
DACN-Traffic-ETL/
├── .github/workflows/
│   └── etl_cron.yml          # GitHub Actions 24/7 Automation Workflow
├── config/
│   ├── nodes.yaml            # Cấu hình 22 Node Agents (Quận 10 & Tân Bình)
│   └── etl.yaml              # Cấu hình tần suất 5 phút/lần (00:00-23:59)
├── dashboard/                # Mã nguồn Web Dashboard (React + Vite + GIS)
│   ├── public/               # Dữ liệu JSON thời gian thực
│   ├── src/                  # Các Tab bản đồ, KPI, Biểu đồ vận tốc
│   └── dist/                 # Bản build web tĩnh sẵn sàng Go Live
├── etl/                      # Thư viện thuật toán hợp nhất dữ liệu (Python)
├── outputs/                  # Kết quả lưu trữ dữ liệu Parquet và JSON
├── auto_run.py               # Lịch trình tự động chạy 5 phút/lần local
├── generate_data.py          # Script chạy ETL pipeline chính
├── export_json.py            # Script xuất dữ liệu JSON public cho Dashboard
└── run_raw_measurement.py    # Script thu thập dữ liệu đo thô
```

## 🧭 5. QUY TRÌNH SPEC-DRIVEN VỚI SPEC KIT

Repository này đã có scaffold cục bộ trong thư mục `.specify/` để áp dụng Spec-Driven Development cho các thay đổi không tầm thường.

Quy trình khuyến nghị:

1. Cập nhật nguyên tắc dự án trong `.specify/constitution.md`
2. Tạo feature mới trong `.specify/specs/<id-ten-tinh-nang>/`
3. Viết `spec.md` cho **what/why**
4. Viết `plan.md` cho giải pháp kỹ thuật
5. Viết `tasks.md` theo thứ tự phụ thuộc
6. Chỉ triển khai sau khi spec/plan/tasks đã rõ ràng

Có thể cài CLI chính thức của Spec Kit sau:

```powershell
python -m pip install specify-cli
specify init --here --force --integration copilot --script ps
```

Ngoài ra, repo có `CONTEXT.md` để giữ **shared language** cho các thuật ngữ như `raw_measurement`, `node_states`, `osm_matched`, `fused_velocity`, và thang **LOS đảo ngược**.

### Xoay vòng API Key (API Key Rotation)
Hệ thống lấy mẫu trên diện rộng 22 node tiêu tốn khoảng hơn 300 requests mỗi 5 phút. Để không bị giới hạn quota của TomTom, hệ thống hỗ trợ tích hợp nhiều API key:

```text
TOMTOM_API_KEYS=key1_xxx,key2_yyy,key3_zzz
```
