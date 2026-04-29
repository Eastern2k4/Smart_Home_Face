# Hướng Dẫn Cấu Hình ESP32-CAM

## 1️⃣ Chuẩn bị

### Phần cứng cần thiết:
- **ESP32-CAM module**
- **FTDI USB to Serial adapter** (hoặc UART converter)
- **Dây USB micro** (để cấp nguồn)
- **Dây kết nối** (DuPont jumper)

### Phần mềm:
- Arduino IDE 1.8.13+ hoặc VS Code + PlatformIO
- Driver CH340 (nếu sử dụng FTDI converter)

---

## 2️⃣ Kết Nối Phần Cứng

### Sơ đồ kết nối FTDI USB to Serial:

```
FTDI Module    →    ESP32-CAM
─────────────────────────────
VCC (3.3V)    →    3V3
GND           →    GND
TX            →    U0R
RX            →    U0T
```

### Kết nối GPIO cho tương lai (Relay/PIR):

```
ESP32-CAM GPIO Mapping:
─────────────────────
GPIO 12   → Relay (mở cửa)
GPIO 13   → PIR Sensor (phát hiện chuyển động)
GPIO 32   → Extra IO
GPIO 33   → Extra IO
```

> ⚠️ **Lưu ý:** GPIO 12 và 13 không được dùng cho Camera

---

## 3️⃣ Cài đặt Arduino IDE

### Bước 1: Thêm Board Manager URL
1. **File** → **Preferences**
2. Tìm dòng: `Additional Boards Manager URLs`
3. Paste URL:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Nhấn OK

### Bước 2: Cài Package ESP32
1. **Tools** → **Board** → **Boards Manager**
2. Tìm: `esp32`
3. Cài package bới Espressif Systems

### Bước 3: Chọn Board
1. **Tools** → **Board** → **ESP32 Arduino**
2. Chọn: `AI Thinker ESP32-CAM`

### Bước 4: Chọn Port
1. **Tools** → **Port** → Chọn `COM*` (FTDI device)

### Bước 5: Cấu hình Upload
```
Board:        AI Thinker ESP32-CAM
Port:         COM* (FTDI/Serial)
Upload Speed: 115200
Baud Rate:    115200
```

---

## 4️⃣ Sửa Code Trước Khi Flash

### File: `CameraWebServer/CameraWebServer.ino`

#### **Sửa 1: Wi-Fi SSID & Password (dòng ~22)**
```cpp
// TRƯỚC:
const char* ssid = "SSID";
const char* password = "PASSWORD";

// SAU (sửa thành Wi-Fi nhà bạn):
const char* ssid = "My_WiFi_Network";
const char* password = "MyPassword123";
```

#### **Sửa 2: IP PC Server (dòng ~138)**

Đầu tiên, **tìm IP của máy PC:**

**Windows:**
```powershell
ipconfig
# Tìm dòng: IPv4 Address: 192.168.x.x
```

**Linux/Mac:**
```bash
ifconfig
# Tìm dòng: inet 192.168.x.x
```

Sau đó sửa code:
```cpp
// TRƯỚC:
http.begin("http://10.136.25.165:5000/upload");

// SAU (sửa IP của PC):
http.begin("http://192.168.1.100:5000/upload");  // Thay 192.168.1.100 thành IP PC
```

---

## 5️⃣ Flash Code vào ESP32

### Bước 1: Chuẩn bị ESP32-CAM

**Cách 1: GPIO0 kết nối GND để vào Download Mode**
```
Khi upload code:
  GPIO0 (IO0) → GND (giữ 1-2 giây)
  Sau đó nhả
```

**Cách 2: Nút bấm (nếu board có)**
- Nhấn nút `IO0`
- Upload code
- Nhả nút

### Bước 2: Upload

1. **Sketch** → **Upload**
   - Hoặc nhấn Ctrl+U

2. **Chờ khoảng 30-60 giây**

3. **Output:**
   ```
   Leaving...
   Hard resetting via RTS pin...
   ```

---

## 6️⃣ Kiểm Tra Kết Nối

### Mở Serial Monitor

1. **Tools** → **Serial Monitor**
2. **Baud Rate:** `115200`

### Xem Output
```
[  ] PSRAM detected: 0
Found 4 design specs matching filter start value 1
[ ] PSRAM not re-initialized, keep internal initialisation in JTAG mode for now.
ESP32 module detected.
Using this pin config:
...
Camera Ready! Use 'http://192.168.1.102'
Connecting to SSID My_WiFi_Network
```

✅ **Nếu thấy:** `Camera Ready! Use 'http://192.168.x.x'`
→ **ESP32-CAM đã sẵn sàng!**

---

## 7️⃣ Tìm IP ESP32

### Cách 1: Serial Monitor (khuyến nghị)
- Xem dòng: `Camera Ready! Use 'http://192.168.1.102'`
- IP là: **192.168.1.102**

### Cách 2: Router
- Vào `192.168.1.1` (gateway)
- Xem **DHCP Client List**
- Tìm device `esp32`

### Cách 3: Scan Network
```bash
# Linux/Mac:
nmap -sn 192.168.1.0/24

# Windows (cần cài Nmap):
nmap -sn 192.168.1.0/24
```

---

## 8️⃣ Test Snapshot

### Cách 1: Trình duyệt
```
http://192.168.1.102/capture
```
→ Tải ảnh JPG

### Cách 2: Terminal
```bash
curl -O http://192.168.1.102/capture
```

### Cách 3: Web App
1. Chạy Flask: `python app.py`
2. Mở: `http://localhost:5000`
3. Tab **ESP32** → Nhập: `http://192.168.1.102/capture`
4. Nhấn: **Fetch ESP32 Snapshot**

---

## 🔧 Cấu Hình Nâng Cao

### Thay đổi Port HTTP (nếu cần)

**File:** `CameraWebServer/app_httpd.cpp` (dòng ~650)

```cpp
// TRƯỚC:
httpd_port_t config_port = 80;

// SAU (thay đổi port):
httpd_port_t config_port = 8080;  // Port 8080
```

Sau đó truy cập: `http://192.168.1.102:8080/capture`

### Điều chỉnh Chất Lượng Ảnh

**File:** `CameraWebServer/app_httpd.cpp` (tìm `res1024x768`)

```cpp
// Độ phân giải (tìm các tùy chọn):
// FRAMESIZE_QVGA:    320x240
// FRAMESIZE_VGA:     640x480
// FRAMESIZE_SVGA:    800x600
// FRAMESIZE_XGA:     1024x768
```

### Độ Sáng (Brightness)

Thêm vào `CameraWebServer.ino` trong `setup()`:

```cpp
sensor_t * s = esp_camera_sensor_get();
s->set_brightness(s, 1);    // 0-4, 2 là mặc định
s->set_contrast(s, 1);      // 0-4
s->set_saturation(s, 0);    // -2-2
```

---

## 🐛 Xử lý Lỗi

### Lỗi: `Brownout detector triggered`
- ⚠️ ESP32 hết điện
- ✅ Kiểm tra nguồn 3.3V
- ✅ Dùng dây giảm từ 5V xuống 3.3V (voltage regulator)

### Lỗi: `Flash read err, 1000`
- ⚠️ Kết nối USB bị lỏng
- ✅ Kiểm tra dây kết nối FTDI
- ✅ Thử lại

### Lỗi: `COM port not found`
- ⚠️ Driver USB thiếu
- ✅ Cài driver CH340
- ✅ Kiểm tra Device Manager

### Lỗi: `Connection refused`
- ⚠️ Wi-Fi không kết nối
- ✅ Kiểm tra SSID & password
- ✅ Xem Serial Monitor

---

## 💡 Tips

1. **Giữ GPIO0 hạ xuống GND** khi upload để vào download mode
2. **Baud rate phải 115200**
3. **Kiểm tra LED màu đỏ** → đang hoạt động
4. **Nếu treo**, nhấn nút reset
5. **Để mặc định** nếu không biết cấu hình

---

**Chúc thành công! 🚀**
