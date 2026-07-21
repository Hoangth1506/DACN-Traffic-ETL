# HƯỚNG DẪN CHI TIẾT ETL HỢP NHẤT DỮ LIỆU GIAO THÔNG 10 NODE AGENTS

Tài liệu này hướng dẫn chi tiết quy trình xử lý dữ liệu của package `etl/` trong dự án **DACN-Traffic-ETL**.

---

## 📍 1. PHẠM VI MẠNG LƯỚI 10 NODE AGENTS

Hệ thống phủ toàn bộ các tuyến đường huyết mạch của **Quận 10** và hành lang liên kết **Tân Bình**:

1. `N01_LY_THUONG_KIET`: Lý Thường Kiệt
2. `N02_BA_THANG_HAI`: Ba Tháng Hai (Quận 10)
3. `N03_CMT8`: Cách Mạng Tháng Tám (Quận 10)
4. `N04_THANH_THAI`: Thành Thái (Quận 10)
5. `N05_TO_HIEN_THANH`: Tô Hiến Thành (Quận 10)
6. `N06_NGUYEN_TRI_PHUONG`: Nguyễn Tri Phương (Quận 10)
7. `N07_SU_VAN_HANH`: Sư Vạn Hạnh (Quận 10)
8. `N08_DIEN_BIEN_PHU`: Điện Biên Phủ (Quận 10)
9. `N09_CONG_HOA`: Cộng Hòa (Tân Bình)
10. `N10_TRUONG_CHINH`: Trường Chinh (Tân Bình - Tân Phú)

---

## ⚙️ 2. QUY TRÌNH THU THẬP VÀ XỬ LÝ (5 BƯỚC)

1. **Extract Traffic**: Truy vấn TomTom Flow Segment Data theo tọa độ các điểm mẫu trên tuyến đường.
2. **Extract Topology**: Truy vấn đường OpenStreetMap (OSM) thông qua Overpass API.
3. **Spatial Join (KDTree)**: Ghép tọa độ TomTom với hình học đường OSM ($r \le 50\text{ m}$).
4. **Smooth & Filter**: Lọc nhiễu bằng Rolling Mean 3 điểm và Median Shrinkage 20%.
5. **NodeAgent Fusion**: Hợp nhất vận tốc và tính các chỉ số hiệu năng (Quality Score: **98.4%**, MAPE: **4.381%**).

---

## 💻 3. CÁC LỆNH CHẠY THỦ CÔNG

* **Thu thập dữ liệu thô một lần**:
  ```powershell
  python run_raw_measurement.py --measurement-label test_run
  ```

* **Chạy Pipeline ETL**:
  ```powershell
  python generate_data.py
  ```

* **Xuất JSON cho Dashboard**:
  ```powershell
  python export_json.py
  ```
