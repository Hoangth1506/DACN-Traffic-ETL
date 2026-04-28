import time
import subprocess
from datetime import datetime
import sys

def get_seconds_to_next_run():
    now = datetime.now()
    # Tính số phút cần chờ để tới phút 00 hoặc 30 tiếp theo
    minutes_to_next = 30 - (now.minute % 30)
    if minutes_to_next == 30 and now.second == 0:
        return 0
    
    # Tính tổng số giây cần chờ
    seconds_to_wait = (minutes_to_next * 60) - now.second
    return seconds_to_wait

def main():
    print("=== HỆ THỐNG TỰ ĐỘNG CHẠY LẤY DỮ LIỆU (AUTO SCHEDULER) ===")
    print("Chương trình sẽ tự động chạy mỗi 30 phút (tại phút 00 và phút 30).")
    print("Các khung giờ lấy dữ liệu hợp lệ được cấu hình trong config/etl.yaml (ví dụ: 06:00-08:00, 11:00-13:00, 16:00-19:00)")
    print("-> Bạn chỉ cần TREO cửa sổ này, không cần chạy thủ công nữa.\n")
    
    # Nếu vừa bật lên mà muốn chạy luôn 1 lần đầu thì uncomment dòng dưới
    # subprocess.run([sys.executable, "run_etl.py", "--respect-windows"])
    
    while True:
        wait_sec = get_seconds_to_next_run()
        if wait_sec > 0:
            next_run = datetime.fromtimestamp(time.time() + wait_sec)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Đang chờ tới lần chạy tiếp theo lúc: {next_run.strftime('%H:%M:%S')}")
            time.sleep(wait_sec)
        
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Bắt đầu lấy dữ liệu...")
        
        # Gọi run_etl.py với cờ --respect-windows. 
        # Cờ này giúp pipeline tự kiểm tra xem giờ hiện tại có nằm trong etl.yaml "windows" hay không.
        # Nếu có nó sẽ lấy dữ liệu, nếu không nó sẽ tự động skip.
        subprocess.run([sys.executable, "run_etl.py", "--respect-windows"])
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Xong! Chuẩn bị tính toán cho chu kỳ tiếp theo...\n")
        
        # Ngủ thêm 2 giây để tránh việc chạy lặp lại trong cùng 1 giây
        time.sleep(2)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nĐã dừng Auto Scheduler.")
