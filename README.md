# Smart Home Face Recognition System

Hệ thống nhận diện khuôn mặt tích hợp ESP32-CAM để mở cửa thông minh. Sử dụng DeepFace và OpenCV để xác thực khuôn mặt với độ chính xác cao.

## 🎯 Tính năng

- ✅ Nhận diện khuôn mặt qua ảnh upload
- ✅ Lấy snapshot từ ESP32-CAM qua mạng Wi-Fi
- ✅ Dùng camera máy tính để capture và xác thực
- ✅ Quản lý cơ sở dữ liệu khuôn mặt
- ✅ Giao diện web đẹp và dễ sử dụng (Flask + Next.js Frontend)
- ✅ API endpoint để ESP32-CAM gửi ảnh tự động
- ✅ Điều khiển thiết bị smart home (đèn, cảm biến, servo)

## 📋 Yêu cầu

### Phần cứng
- **ESP32-CAM** (với camera OV2640)
- **PC/Laptop** chạy Flask server
- **Cùng mạng Wi-Fi** giữa ESP32 và PC

### Phần mềm
- Python 3.8+
- pip (trình quản lý package Python)

## 🚀 Cài đặt

### 1. Clone Repository
```bash
git clone https://github.com/Eastern2k4/Smart_Home_Face.git
cd Smart_Home_Face
```

### 2. Tạo Virtual Environment
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux/Mac
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Cài Dependencies
```bash
pip install -r requirements.txt
```

### 4. **[QUAN TRỌNG]** Sửa IP ESP32 trong CameraWebServer.ino

Nếu sử dụng sketch ESP32 tự động gửi ảnh:

**Tệp:** `CameraWebServer/CameraWebServer.ino` (dòng ~138)

```cpp
// TRƯỚC (sai):
http.begin("http://10.136.25.165:5000/upload");

// SAU (đúng - thay IP máy PC):
http.begin("http://192.168.1.100:5000/upload");  // Đổi 192.168.1.100 thành IP PC của bạn
```

### 5. Flash Code vào ESP32
```bash
# Dùng Arduino IDE hoặc VS Code + PlatformIO
# Mở file: CameraWebServer/CameraWebServer.ino
# Flash vào ESP32-CAM
```

### 6. Cấu hình ESP32 Wi-Fi

Trong `CameraWebServer/CameraWebServer.ino`, sửa thông tin Wi-Fi (dòng ~22):

```cpp
const char* ssid = "YOUR_SSID";         // Tên Wi-Fi
const char* password = "YOUR_PASSWORD"; // Mật khẩu Wi-Fi
```

## ▶️ Chạy Ứng Dụng

### 1. Khởi động Flask Server
```bash
python src/app.py
```

**Output:**
```
WARNING: This is a development server. Do not use it in production deployments.
Use a production WSGI server instead.
* Running on http://0.0.0.0:5001
```

`app.py` ở thư mục gốc là backend legacy. Backend chính hiện tại là `src/app.py`.

### 2. Mở Trình Duyệt
- Truy cập frontend Next.js và cấu hình backend URL là `http://localhost:5001`

### 3. Thêm Khuôn Mặt vào Database

1. Nhấn nút **➕ Add New Face**
2. Nhập tên người
3. Chọn ảnh khuôn mặt rõ ràng
4. Nhấn **Add Face**

### 4. Test Xác Thực

#### **Tab Upload**
- Click vào ô upload hoặc kéo thả ảnh
- Hệ thống sẽ kiểm tra và hiển thị kết quả

#### **Tab Camera**
- Nhấn **🎥 Start Camera**
- Nhấn **📸 Capture & Verify** để chụp ảnh
- Xem kết quả xác thực

#### **Tab ESP32**
- Nhập địa chỉ: `http://<ESP32_IP>/capture`
- Ví dụ: `http://192.168.1.102/capture`
- Nhấn **📡 Fetch ESP32 Snapshot**

## 📁 Cấu Trúc Thư Mục

```
Smart_Home_Face/
├── app.py                    # Legacy Flask backend
├── src/                      # Modular Flask backend chính
│   ├── app.py                # Entry point backend trên port 5001
│   └── api/                  # API blueprints
├── requirements.txt          # Dependencies
├── README.md                 # File này
├── templates/
│   └── index.html           # Giao diện web
├── static/
│   ├── script.js            # Logic JavaScript
│   └── style.css            # Styling
├── faces/                   # Database khuôn mặt
├── temp/                    # Thư mục tạm (xóa tự động)
├── CameraWebServer/         # Code ESP32-CAM
│   ├── CameraWebServer.ino  # Sketch chính
│   ├── app_httpd.cpp        # HTTP server ESP32
│   ├── camera_pins.h        # Cấu hình GPIO
│   └── board_config.h       # Cấu hình board
└── datasets/                # Thư mục dự trữ
```

## 🔧 API Endpoints

### `/api/verify-face` (POST)
Xác thực ảnh upload
```bash
curl -X POST -F "image=@photo.jpg" http://localhost:5001/api/verify-face
```

### `/api/add-face` (POST)
Thêm khuôn mặt mới
```bash
curl -X POST -F "image=@photo.jpg" -F "name=John" http://localhost:5001/api/add-face
```

### `/api/delete-face` (POST)
Xóa khuôn mặt
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"John"}' http://localhost:5001/api/delete-face
```

### `/api/get-faces` (GET)
Lấy danh sách khuôn mặt
```bash
curl http://localhost:5001/api/get-faces
```

### `/api/esp32/snapshot` (GET)
Lấy snapshot từ ESP32-CAM
```bash
curl "http://localhost:5001/api/esp32/snapshot?camera_url=http://192.168.1.102/capture"
```

### `/api/arduino/register/sensor` (POST)
ESP32 Sensor Node đăng ký IP với backend
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"ip":"192.168.1.50"}' http://localhost:5001/api/arduino/register/sensor
```

## ⚙️ Những Phần Cần Sửa Khi Clone

| Phần | Vị trí | Mục đích |
|------|--------|---------|
| **IP PC** | `CameraWebServer/CameraWebServer.ino:138` | Sửa thành IP máy tính chạy Flask |
| **SSID Wi-Fi** | `CameraWebServer/CameraWebServer.ino:22` | Tên Wi-Fi nhà bạn |
| **Password Wi-Fi** | `CameraWebServer/CameraWebServer.ino:23` | Mật khẩu Wi-Fi |
| **Port Flask** | `src/app.py` | Nếu port 5001 bị chiếm dụng |
| **Host Flask** | `src/app.py` | Thay `0.0.0.0` nếu muốn kết nối từ device khác |

## 🔍 Tìm IP ESP32

1. **Mở Serial Monitor** (Arduino IDE)
2. **Chạy sketch** ESP32-CAM
3. **Tìm dòng:** `Camera Ready! Use 'http://192.168.x.x'`
4. **Đó là IP** của ESP32

Hoặc xem trong **Router settings** → Connected devices

## 🔐 Tìm IP PC

**Windows:**
```bash
ipconfig
```
Tìm dòng `IPv4 Address` trong adapter Wi-Fi/Ethernet

**Linux/Mac:**
```bash
ifconfig
```

## 🐛 Xử lý Lỗi

### Lỗi: `Connection refused`
- ✅ Kiểm tra Flask server đang chạy
- ✅ Kiểm tra IP ESP32 có đúng không
- ✅ Kiểm tra firewall cho phép port 5001

### Lỗi: `Face not detected`
- ✅ Chụp ảnh rõ ràng, mặt không bị che
- ✅ Độ sáng tốt
- ✅ Khuôn mặt hướng về camera

### Lỗi: `No module named 'deepface'`
- ✅ Chạy: `pip install deepface opencv-python werkzeug flask`

## 📝 License

Dự án này được tạo cho mục đích học tập và sử dụng cá nhân.

## 👨‍💻 Tác Giả

Eastern2k4 - Smart Home IoT Project

## 📞 Hỗ Trợ

Nếu gặp lỗi:
1. Kiểm tra requirements.txt đã cài đủ không
2. Kiểm tra IP ESP32 và IP PC
3. Xem xét firewall
4. Tạo issue trên GitHub

---

**Chúc bạn thành công! 🎉**
