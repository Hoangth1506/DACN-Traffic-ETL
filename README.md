# HỆ THỐNG GIÁM SÁT VÀ DỰ BÁO GIAO THÔNG THỜI GIAN THỰC (REAL-TIME 24/7)
## ĐỒ ÁN CHUYÊN NGÀNH 2026 — KIẾN TRÚC NODE-AGENT-EDGE ALL-IN-ONE

Hệ thống hợp nhất toàn bộ quy trình **Thu thập dữ liệu thô (ETL Backend)**, **Thuật toán Hợp nhất Dữ liệu (NodeAgent Fusion Engine)** và **Giao diện Giám sát Bản đồ GIS (React Vite Dashboard)** trong duy nhất Repository này.

---

## 🎯 1. ĐẶC ĐIỂM NỔI BẬT & RÀNG BUỘC HỆ THỐNG

1. **🛑 100% Không dùng Camera Vật lý / Không Video**:
   * Hệ thống vận hành hoàn toàn dựa trên cảm biến ảo từ **TomTom Traffic Flow API** kết hợp với mạng lưới hạ tầng đường bộ **OpenStreetMap (OSM)** thông qua giải thuật **KDTree Spatial Join** ($r \le 50\text{ m}$).
2. **📍 Mạng lưới 10 Node Agents (Bao trọn 100% Quận 10 & Tân Bình)**:
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
3. **⚡ Tần suất Real-Time Siêu tốc 2 phút/lần (24/7 Continuous Stream)**:
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

### 🔹 Cách 1: Chạy Tự Động trên Máy Cá Nhân (Local 2 phút/lần)
Mở Terminal trong thư mục dự án và chạy:
```powershell
# 1. Kích hoạt bộ đếm tự động lấy dữ liệu liên tục 2 phút/lần
python auto_run.py

# 2. Khởi chạy Web Dashboard trực tiếp
cd dashboard
npm run dev
```
Trang web sẽ phát trực tiếp tại **`http://localhost:3000`**.

### 🔹 Cách 2: Tự Động Hóa 24/7 trên Đám Mây (GitHub Actions)
Tệp workflow `.github/workflows/etl_cron.yml` được tích hợp sẵn trên branch `main`:
1. **Extract**: Thu thập dữ liệu thô từ TomTom API & OSM.
2. **ETL**: Hợp nhất và tính toán sai số.
3. **Export**: Xuất JSON public cho Dashboard.
4. **Build**: Rebuild ứng dụng web Vite (`dashboard/dist/`).
5. **Push**: Tự động commit và lưu kết quả về GitHub.

Bạn có thể vào tab **`Actions`** trên GitHub $\rightarrow$ Bấm nút **`Run workflow`** bất cứ lúc nào để máy chủ thu thập dữ liệu mới ngay lập tức!

---

## 📁 4. CẤU TRÚC MÃ NGUỒN ALL-IN-ONE

```text
DACN-Traffic-ETL/
├── .github/workflows/
│   └── etl_cron.yml          # GitHub Actions 24/7 Automation Workflow
├── config/
│   ├── nodes.yaml            # Cấu hình 10 Node Agents (Quận 10 & Tân Bình)
│   └── etl.yaml              # Cấu hình tần suất 2 phút/lần (00:00-23:59)
├── dashboard/                # Mã nguồn Web Dashboard (React + Vite + GIS)
│   ├── public/               # Dữ liệu JSON thời gian thực
│   ├── src/                  # Các Tab bản đồ, KPI, Biểu đồ vận tốc
│   └── dist/                 # Bản build web tĩnh sẵn sàng Go Live
├── etl/                      # Thư viện thuật toán hợp nhất dữ liệu (Python)
├── outputs/                  # Kết quả lưu trữ dữ liệu Parquet và JSON
├── auto_run.py               # Lịch trình tự động chạy 2 phút/lần local
├── generate_data.py          # Script chạy ETL pipeline chính
├── export_json.py            # Script xuất dữ liệu JSON public cho Dashboard
└── run_raw_measurement.py    # Script thu thập dữ liệu đo thô
```
