# Hệ thống nhận diện khuôn mặt cho nhà thông minh

Hệ thống nhà thông minh tích hợp nhận diện khuôn mặt, ESP32-CAM và ESP32 Sensor Node. Backend Flask trong thư mục `src/` xử lý API, nhận đăng ký thiết bị ESP32, chuyển tiếp dữ liệu cảm biến/thiết bị, chuyển tiếp camera và chạy nhận diện khuôn mặt. Frontend Next.js gọi backend để hiển thị trạng thái và điều khiển thiết bị.

## Tính năng

- Nhận diện khuôn mặt qua ảnh tải lên.
- Lấy snapshot và stream từ ESP32-CAM qua mạng Wi-Fi.
- Quản lý cơ sở dữ liệu khuôn mặt.
- Giao diện frontend Next.js để xem trạng thái hệ thống.
- API backend Flask trong `src/` cho frontend và ESP32.
- Điều khiển thiết bị nhà thông minh: đèn, cửa, cảm biến và loa.
- ESP32 Sensor Node và ESP32-CAM tự đăng ký IP với backend.

## Yêu cầu

### Phần cứng

- ESP32-CAM với camera OV2640.
- ESP32 Sensor Node.
- PC hoặc laptop chạy backend Flask và frontend Next.js.
- Tất cả thiết bị phải nằm trong cùng mạng LAN/Wi-Fi.

### Phần mềm

- Python 3.11.
- pip.
- Node.js và pnpm.
- Arduino CLI hoặc Arduino IDE để flash ESP32.
- ESP32 Arduino core.

## Cấu hình

Hệ thống có bốn thành phần khi chạy:

- Frontend Next.js.
- Backend Flask trong `src/`.
- ESP32 Sensor Node.
- ESP32-CAM.

Backend chạy trên port `8000` theo mặc định.

### 1. Tạo file cấu hình local

Tạo file:

```text
config/app.local.json
```

Ví dụ:

```json
{
  "backend": {
    "host": "172.16.3.201",
    "port": 8000
  },
  "wifi": {
    "ssid": "YOUR_WIFI",
    "password": "YOUR_PASSWORD"
  }
}
```

Sử dụng IP LAN thật của laptop hoặc PC cho `backend.host`.

Không dùng `localhost` cho ESP32, vì ESP32 không thể truy cập backend trên máy tính thông qua `localhost`.

### 2. Tìm IP LAN của backend

Linux/macOS:

```bash
ip addr
# hoặc
ifconfig
```

Windows:

```bash
ipconfig
```

Ví dụ IP LAN:

```text
172.16.3.201
```

### 3. Khởi động backend

```bash
python -m src.app
```

URL backend mong đợi:

```text
http://172.16.3.201:8000
```

Backend chính hiện tại là `src/app.py`.

### 4. Cấu hình frontend

Tạo file môi trường cho frontend nếu cần:

```text
NEXT_PUBLIC_BACKEND_URL=http://172.16.3.201:8000
```

Nếu không có `NEXT_PUBLIC_BACKEND_URL`, frontend mặc định gọi:

```text
http://<browser-hostname>:8000
```

### 5. Tạo cấu hình firmware

Khi backend khởi động, hệ thống tự tạo `config.generated.h` cho các project ESP32:

- `CameraWebServer/config.generated.h`
- `ESP32_SensorNode/config.generated.h`

Hai file generated này bị ignore bởi Git để không commit Wi-Fi/password.

Trước khi flash ESP32, kiểm tra file generated có đúng giá trị thật:

```cpp
BACKEND_HOST = "172.16.3.201"
BACKEND_PORT = 8000
WIFI_SSID = "YOUR_WIFI"
WIFI_PASSWORD = "YOUR_PASSWORD"
```

Project hiện dùng kiểu `static const` trong các header generated.

### 6. Lưu ý về `auto`

`backend.host = "auto"` có thể chọn sai IP nếu máy có nhiều network interface như Docker, VPN, Ethernet, Wi-Fi hoặc Tailscale.

Khi demo, nên dùng IP LAN cụ thể:

```json
{
  "backend": {
    "host": "172.16.3.201",
    "port": 8000
  }
}
```

## Cài đặt

### 1. Clone mã nguồn

```bash
git clone https://github.com/Eastern2k4/Smart_Home_Face.git
cd Smart_Home_Face
```

### 2. Tạo môi trường ảo Python

Windows:

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Cài thư viện Python

```bash
pip install -r requirements.txt
```

### 4. Cài thư viện frontend

```bash
cd frontend
pnpm install
```

Nếu pnpm chặn build script của `sharp`, chạy:

```bash
pnpm approve-builds
pnpm install
```

### 5. Cấu hình backend và Wi-Fi

Không sửa Wi-Fi hoặc backend IP trực tiếp trong file `.ino`.

Tạo file local config từ file mẫu:

```bash
cp config/app.example.json config/app.local.json
```

Sửa `config/app.local.json`:

```json
{
  "backend": {
    "host": "172.16.3.201",
    "port": 8000
  },
  "wifi": {
    "ssid": "YOUR_WIFI",
    "password": "YOUR_PASSWORD"
  }
}
```

Sau đó khởi động backend để tạo file cấu hình firmware:

```bash
python -m src.app
```

## Chạy ứng dụng

### 1. Chạy backend Flask

```bash
python -m src.app
```

Kết quả mong đợi:

```text
* Running on http://0.0.0.0:8000
```

### 2. Chạy frontend Next.js

```bash
cd frontend
pnpm run dev
```

Mở frontend trong trình duyệt theo URL mà Next.js hiển thị.

### 3. Nạp firmware cho ESP32

Nạp hai sketch:

- `ESP32_SensorNode/ESP32_SensorNode.ino`
- `CameraWebServer/CameraWebServer.ino`

Sau khi flash, cả hai ESP32 phải kết nối Wi-Fi và đăng ký về backend.

### 4. Kiểm tra đăng ký thiết bị

```bash
curl http://localhost:8000/api/arduino/status
```

Kết quả mong đợi:

```json
{
  "sensor_node": {
    "connected": true
  },
  "camera_node": {
    "connected": true
  }
}
```

Nếu thiết bị chưa connected, kiểm tra:

- SSID/password Wi-Fi.
- IP LAN của backend.
- Port backend `8000`.
- Serial Monitor của ESP32.
- Firewall trên máy chạy backend.

## Cấu trúc thư mục

```text
Smart_Home_Face/
├── src/                      # Backend Flask chính
│   ├── app.py                # Entry point backend trên port 8000
│   └── api/                  # API blueprints
├── config/                   # File cấu hình backend và firmware
├── frontend/                 # Frontend Next.js
├── requirements.txt          # Python dependencies
├── README.md                 # Tài liệu dự án
├── faces/                    # Database khuôn mặt
├── temp/                     # Thư mục tạm
├── CameraWebServer/          # Firmware ESP32-CAM
└── ESP32_SensorNode/         # Firmware ESP32 Sensor Node
```

## API chính

### `GET /api/arduino/status`

Kiểm tra trạng thái đăng ký của ESP32 Sensor Node và ESP32-CAM.

```bash
curl http://localhost:8000/api/arduino/status
```

### `GET /api/sensors`

Đọc dữ liệu cảm biến từ ESP32 Sensor Node.

```bash
curl http://localhost:8000/api/sensors
```

### `GET /api/devices`

Đọc trạng thái thiết bị từ ESP32 Sensor Node.

```bash
curl http://localhost:8000/api/devices
```

### `POST /api/control/door/open`

Mở cửa.

```bash
curl -X POST http://localhost:8000/api/control/door/open
```

### `POST /api/control/door/close`

Đóng cửa.

```bash
curl -X POST http://localhost:8000/api/control/door/close
```

### `GET /api/speaker/settings`

Đọc cấu hình loa từ ESP32 Sensor Node.

```bash
curl http://localhost:8000/api/speaker/settings
```

### `POST /api/speaker/audio`

Cập nhật cấu hình âm thanh của loa.

```bash
curl -X POST http://localhost:8000/api/speaker/audio \
  -H "Content-Type: application/json" \
  -d '{"frontVolume":80,"indoorVolume":60,"frequency":880,"duration":5000}'
```

### `POST /api/speaker/test/front`

Test loa phía trước.

```bash
curl -X POST http://localhost:8000/api/speaker/test/front
```

### `POST /api/speaker/test/indoor`

Test loa trong nhà.

```bash
curl -X POST http://localhost:8000/api/speaker/test/indoor
```

### `GET /api/esp32/snapshot`

Lấy ảnh snapshot từ ESP32-CAM.

```bash
curl http://localhost:8000/api/esp32/snapshot
```

### `GET /api/esp32/stream`

Chuyển tiếp camera stream từ ESP32-CAM.

```bash
curl http://localhost:8000/api/esp32/stream
```

### `POST /api/verify-face`

Xác thực khuôn mặt từ ảnh tải lên.

```bash
curl -X POST -F "image=@photo.jpg" http://localhost:8000/api/verify-face
```

### `POST /api/add-face`

Thêm khuôn mặt mới.

```bash
curl -X POST -F "image=@photo.jpg" -F "name=John" http://localhost:8000/api/add-face
```

### `POST /api/delete-face`

Xóa khuôn mặt.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"John"}' http://localhost:8000/api/delete-face
```

### `GET /api/get-faces`

Lấy danh sách khuôn mặt.

```bash
curl http://localhost:8000/api/get-faces
```

## Kiểm tra firmware bằng Arduino CLI

ESP32-CAM:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32cam CameraWebServer
```

ESP32 Sensor Node:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 ESP32_SensorNode
```

## Các giá trị thường cần đổi khi chạy trên máy khác

| Phần | Vị trí | Mục đích |
|------|--------|----------|
| Host backend | `config/app.local.json` | IP LAN của máy chạy backend |
| Port backend | `config/app.local.json` | Port backend, mặc định là `8000` |
| Wi-Fi SSID | `config/app.local.json` | Tên Wi-Fi |
| Wi-Fi password | `config/app.local.json` | Mật khẩu Wi-Fi |
| URL backend cho frontend | `frontend/.env.local` hoặc biến môi trường | URL backend cho frontend |

## Xử lý lỗi

### Lỗi: `Connection refused`

- Kiểm tra backend Flask đang chạy.
- Kiểm tra frontend đang gọi đúng port `8000`.
- Kiểm tra IP ESP32 có đúng không.
- Kiểm tra firewall cho phép truy cập port `8000`.

### ESP32 không đăng ký được với backend

- Kiểm tra ESP32 và backend có cùng mạng LAN/Wi-Fi không.
- Kiểm tra `BACKEND_HOST` trong `config.generated.h`.
- Kiểm tra `BACKEND_PORT` là `8000`.
- Kiểm tra SSID/password Wi-Fi.
- Mở Serial Monitor để xem log kết nối.

### Camera không hiển thị stream

- Kiểm tra ESP32-CAM đã đăng ký về backend.
- Kiểm tra `/api/arduino/status`.
- Kiểm tra ESP32-CAM có trả về `/capture` và stream port `81`.
- Kiểm tra trình duyệt có truy cập được ESP32-CAM qua LAN không.

### Lỗi: `Face not detected`

- Chụp ảnh rõ ràng, mặt không bị che.
- Đảm bảo ánh sáng đủ tốt.
- Đảm bảo khuôn mặt hướng về camera.

### Lỗi: `No module named 'deepface'`

```bash
pip install -r requirements.txt
```

## Giấy phép

Dự án này được tạo cho mục đích học tập và sử dụng cá nhân.

## Tác giả

Eastern2k4 - Smart Home IoT Project

## Hỗ trợ

Nếu gặp lỗi:

1. Kiểm tra các thư viện phụ thuộc đã cài đầy đủ chưa.
2. Kiểm tra IP ESP32 và IP backend.
3. Kiểm tra firewall.
4. Kiểm tra log backend và Serial Monitor của ESP32.
