import os

def update_env_keys():
    # Đọc keys từ file api_keys.txt
    if not os.path.exists("api_keys.txt"):
        print("Lỗi: Không tìm thấy file api_keys.txt. Vui lòng tạo file này và dán các key vào, mỗi key một dòng.")
        return

    with open("api_keys.txt", "r") as f:
        # Lấy từng dòng, xóa khoảng trắng, bỏ qua dòng trống
        new_keys = [line.strip() for line in f if line.strip()]

    if not new_keys:
        print("Lỗi: Không có key nào trong file api_keys.txt")
        return

    # Lọc trùng lặp
    new_keys = list(dict.fromkeys(new_keys))
    print(f"Đã tìm thấy {len(new_keys)} API keys hợp lệ trong api_keys.txt")

    # Đọc file .env hiện tại
    env_lines = []
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            env_lines = f.readlines()

    # Cập nhật TOMTOM_API_KEYS
    keys_string = ",".join(new_keys)
    found = False
    for i, line in enumerate(env_lines):
        if line.startswith("TOMTOM_API_KEYS="):
            env_lines[i] = f"TOMTOM_API_KEYS={keys_string}\n"
            found = True
            break
    
    if not found:
        env_lines.append(f"TOMTOM_API_KEYS={keys_string}\n")

    # Ghi lại file .env
    with open(".env", "w") as f:
        f.writelines(env_lines)

    print("Thành công! Đã ghi trọn bộ key vào .env. Bạn có thể xóa file api_keys.txt cho an toàn.")

if __name__ == "__main__":
    update_env_keys()
