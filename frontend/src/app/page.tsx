"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Camera,
  DoorClosed,
  DoorOpen,
  Droplets,
  Flame,
  Gauge,
  Home,
  LayoutDashboard,
  Lightbulb,
  Loader,
  Plus,
  Search,
  Settings,
  Speaker,
  Thermometer,
  Upload,
  User,
  UserCheck,
  Video,
  Wifi,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { sensorApi } from "@/lib/api/sensors";
import { faceApi } from "@/lib/api/face";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useAutoLED } from "@/lib/hooks/useAutoLED";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

type RecognitionStatus = {
  running: boolean;
  door_allowed: boolean;
  classification: "idle" | "owner" | "stranger" | "no_face";
  identity: string | null;
  image_path: string | null;
  updated_at: string | null;
  error: string | null;
};

type PageId =
  | "overview"
  | "sensors"
  | "lights"
  | "camera"
  | "face-id"
  | "speakers"
  | "alerts"
  | "settings";

const navItems: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "sensors", label: "Cảm biến", icon: Thermometer },
  { id: "lights", label: "Đèn", icon: Lightbulb },
  { id: "camera", label: "Cửa ra vào", icon: Camera },
  { id: "face-id", label: "Face ID", icon: UserCheck },
  { id: "speakers", label: "Loa", icon: Speaker },
  { id: "alerts", label: "Cảnh báo", icon: Bell },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

const titles: Record<PageId, string> = {
  overview: "Tổng quan",
  sensors: "Cảm biến",
  lights: "Điều khiển đèn",
  camera: "Cửa ra vào",
  "face-id": "Face ID",
  speakers: "Hệ thống loa",
  alerts: "Cảnh báo",
  settings: "Cài đặt",
};

function formatDate() {
  return new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sensorStatus(value: number, warning: number, danger: number) {
  if (value >= danger) return "danger";
  if (value >= warning) return "warning";
  return "normal";
}

function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  status = "normal",
  badge,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: typeof Home;
  status?: "normal" | "warning" | "danger";
  badge?: string;
}) {
  const tone = {
    normal: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[status];

  return (
    <div className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className={cn("rounded-xl p-3", tone)}>
          <Icon className="h-6 w-6" />
        </div>
        {badge && (
          <span
            className={cn("rounded-full px-3 py-1 text-sm font-semibold", tone)}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-7">
        <p className="text-lg text-muted-foreground">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-5xl font-bold leading-none text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-xl text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DoorCameraCard({
  doorOpen,
  streamUrl = "",
}: {
  doorOpen: boolean;
  streamUrl?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-success/10 p-3">
            <Camera className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-foreground">
              ESP32-CAM - Cửa ra vào
            </h3>
            <p className="text-success">Trực tuyến</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          {doorOpen ? (
            <DoorOpen className="h-5 w-5 text-success" />
          ) : (
            <DoorClosed className="h-5 w-5" />
          )}
          <Video className="h-5 w-5" />
        </div>
      </div>
      <div className="overflow-hidden bg-black">
        {streamUrl ? (
          <div className="flex justify-center bg-black py-6">
            <img
              src={streamUrl}
              alt="ESP32 Stream"
              className="
      aspect-square
      w-[420px]
      object-contain
      rounded-xl
      bg-black
    "
            />
          </div>
        ) : (
          <div className="flex h-[360px] items-center justify-center text-muted-foreground">
            Loading camera stream...
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border px-6 py-4">
        <span className="rounded bg-background px-3 py-1 text-xs font-bold">
          LIVE
        </span>
        <span className="rounded bg-background px-3 py-1 text-xs font-bold">
          {doorOpen ? "DOOR OPEN" : "DOOR CLOSED"}
        </span>
      </div>
    </div>
  );
}

function LightCard({
  id,
  name,
  room,
  enabled,
  autoMode,
  threshold,
  onToggle,
  onAutoChange,
  onThresholdChange,
  busy = false,
}: {
  id: "wc" | "kitchen" | "bedroom";
  name: string;
  room: string;
  enabled: boolean;
  autoMode?: boolean;
  threshold?: number;
  onToggle: (id: "wc" | "kitchen" | "bedroom", checked: boolean) => void;
  onAutoChange?: (checked: boolean) => void;
  onThresholdChange?: (value: number) => void;
  busy?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-7 transition-all",
        enabled
          ? "border-primary shadow-lg shadow-primary/10"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "rounded-xl p-4",
              enabled ? "bg-primary/20" : "bg-muted",
            )}
          >
            <Lightbulb
              className={cn(
                "h-7 w-7",
                enabled ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-foreground">{name}</h3>
            <p className="text-lg text-muted-foreground">{room}</p>
          </div>
        </div>
        <Button
          size="lg"
          disabled={busy}
          className={cn(
            "h-14 rounded-full px-5",
            enabled
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground hover:bg-secondary",
          )}
          onClick={() => onToggle(id, !enabled)}
        >
          {busy ? (
            <Loader className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Zap className="mr-2 h-5 w-5" />
          )}
          {enabled ? "Tắt" : "Bật"}
        </Button>
      </div>

      {onAutoChange && (
        <div className="mt-7 flex items-center justify-between">
          <span className="text-lg text-muted-foreground">Chế độ tự động</span>
          <Switch checked={!!autoMode} onCheckedChange={onAutoChange} />
        </div>
      )}

      {autoMode && threshold !== undefined && onThresholdChange && (
        <div className="mt-6 space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-muted-foreground">Ngưỡng bật</span>
            <span className="font-semibold text-foreground">
              {threshold} cm
            </span>
          </div>
          <Slider
            value={[threshold]}
            min={1}
            max={80}
            step={1}
            onValueChange={([value]) => onThresholdChange(value)}
          />
        </div>
      )}
    </div>
  );
}

function FaceIdPanel() {
  const store = useStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addHostFace = async () => {
    if (!selectedFile) {
      setMessage("Chọn ảnh khuôn mặt Host trước.");
      return;
    }
    setLoading(true);
    try {
      await faceApi.addHostFace(selectedFile);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 1,
        action: "Added Host face to Face ID dataset",
      });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Đã lưu khuôn mặt Host vào faces/Hosts.");
    } catch {
      setMessage("Không thể lưu khuôn mặt Host. Kiểm tra backend Face ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Thêm Host Face ID</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Ảnh sẽ được lưu vào dataset faces/Hosts để camera cửa ra vào nhận diện.
        </p>
        <div className="mt-8 grid gap-4">
          <button
            className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 text-center transition-colors hover:bg-primary/10"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-semibold">
              {selectedFile ? selectedFile.name : "Chọn ảnh khuôn mặt"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">JPG hoặc PNG</p>
          </button>
          <input
            ref={fileRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] ?? null)
            }
          />
          <Button
            className="h-14 rounded-2xl text-lg"
            onClick={addHostFace}
            disabled={loading || !selectedFile}
          >
            {loading ? (
              <Loader className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Plus className="mr-2 h-5 w-5" />
            )}
            Lưu Host vào dataset
          </Button>
          {message && (
            <p className="rounded-xl bg-secondary p-4 text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Trạng thái cửa</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          {store.doorOpen ? "Cửa đang mở" : "Cửa đang đóng"}
        </p>
        <Button
          className="mt-8 h-14 rounded-2xl px-8 text-lg"
          variant="outline"
          onClick={() =>
            sensorApi
              .setDoor(!store.doorOpen)
              .then(() => store.setDoorState(!store.doorOpen))
          }
        >
          {store.doorOpen ? "Đóng cửa" : "Mở cửa"}
        </Button>
      </div>
    </div>
  );
}

export default function SmartHomeDashboard() {
  const [streamUrl, setStreamUrl] = useState("");
  const [recognitionStatus, setRecognitionStatus] =
    useState<RecognitionStatus | null>(null);
  const [recognitionNotice, setRecognitionNotice] = useState<string | null>(
    null,
  );
  const lastRecognitionRef = useRef<string | null>(null);
  const store = useStore();
  useSensorPolling();
  useAutoLED();
  useEffect(() => {
    fetch(`${API_BASE}/api/arduino/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.camera_node?.connected) {
          setStreamUrl(`${API_BASE}/api/esp32/stream`);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch stream URL", err);
      });
  }, []);

  useEffect(() => {
    const fetchRecognitionStatus = () => {
      fetch(`${API_BASE}/api/camera/recognition-status`)
        .then((res) => res.json())
        .then((data: RecognitionStatus) => {
          setRecognitionStatus(data);
          const key = `${data.updated_at}-${data.classification}-${data.identity ?? ""}`;
          if (
            data.updated_at &&
            key !== lastRecognitionRef.current &&
            data.classification !== "idle"
          ) {
            lastRecognitionRef.current = key;
            if (data.door_allowed) {
              setRecognitionNotice(
                `TRUE - Khớp chủ nhà${data.identity ? `: ${data.identity}` : ""}`,
              );
            } else if (data.classification === "stranger") {
              setRecognitionNotice("FALSE - Phát hiện người lạ");
            } else if (data.classification === "no_face") {
              setRecognitionNotice("FALSE - Không phát hiện khuôn mặt");
            }
          }
        })
        .catch((err) => {
          console.error("Failed to fetch camera recognition status", err);
        });
    };

    fetchRecognitionStatus();
    const interval = window.setInterval(fetchRecognitionStatus, 3000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recognitionNotice) return;
    const timer = window.setTimeout(() => setRecognitionNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [recognitionNotice]);
  const [activePage, setActivePage] = useState<PageId>("overview");
  const [speakerOne, setSpeakerOne] = useState(50);
  const [speakerTwo, setSpeakerTwo] = useState(0);
  const [lightBusy, setLightBusy] = useState<
    Partial<Record<"wc" | "kitchen" | "bedroom", boolean>>
  >({});

  const temperature = store.sensors.livingRoom.temperature;
  const humidity = store.sensors.livingRoom.humidity;
  const gas = store.sensors.gas;
  const gasTwo = Math.max(0, Math.round(gas * 0.4));

  const distanceChartData = useMemo(() => {
    const wc = store.stats.wcDistances;
    const kitchen = store.stats.kitchenDistances;
    const length = Math.max(wc.length, kitchen.length, 8);
    return Array.from({ length }, (_, index) => ({
      name: index + 1,
      wc: wc[index] ?? store.sensors.wc.distance,
      kitchen: kitchen[index] ?? store.sensors.kitchen.distance,
    }));
  }, [
    store.stats.wcDistances,
    store.stats.kitchenDistances,
    store.sensors.wc.distance,
    store.sensors.kitchen.distance,
  ]);

  const gasChartData = useMemo(() => {
    const readings =
      store.stats.gasReadings.length > 0
        ? store.stats.gasReadings
        : [gas, gas, gas, gas, gas, gas];
    return readings.map((value, index) => ({ name: index + 1, gas: value }));
  }, [store.stats.gasReadings, gas]);

  const toggleLight = async (
    id: "wc" | "kitchen" | "bedroom",
    checked: boolean,
  ) => {
    setLightBusy((current) => ({ ...current, [id]: true }));
    store.setLedState(id, checked);
    try {
      await sensorApi.toggleLED(id, checked);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "led",
        value: checked ? 1 : 0,
        action: `${id} light turned ${checked ? "ON" : "OFF"}`,
      });
    } catch (error) {
      console.error(`Failed to toggle ${id} light`, error);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "led",
        value: checked ? 1 : 0,
        action: `Failed to toggle ${id} light`,
      });
    } finally {
      setLightBusy((current) => ({ ...current, [id]: false }));
    }
  };

  const setAutoMode = async (id: "wc" | "kitchen", checked: boolean) => {
    store.setAutoLed(id, checked);
    if (!checked) {
      await toggleLight(id, false);
    }
  };

  const alertCount = store.gasAlertActive ? 1 : 0;

  return (
    <main className="grid min-h-screen overflow-x-hidden bg-background text-foreground md:grid-cols-[360px_minmax(0,1fr)]">
      {recognitionNotice && (
        <div
          className={cn(
            "fixed right-6 top-6 z-50 max-w-[min(420px,calc(100vw-3rem))] rounded-xl border px-5 py-4 text-lg font-semibold shadow-lg",
            recognitionNotice.startsWith("TRUE")
              ? "border-success/30 bg-success text-white"
              : "border-destructive/30 bg-destructive text-destructive-foreground",
          )}
        >
          {recognitionNotice}
        </div>
      )}
      <aside className="hidden min-h-screen border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="grid h-24 grid-cols-[1fr_40px] items-center border-b border-sidebar-border px-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary">
              <Home className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="truncate text-3xl font-bold text-sidebar-foreground">
              SmartHome
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-3 p-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={cn(
                  "flex w-full items-center gap-5 rounded-2xl px-5 py-4 text-xl font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-7 w-7 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-success" />
              <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-success opacity-75" />
            </div>
            <span className="text-lg text-muted-foreground">Kết nối MQTT</span>
          </div>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-6 backdrop-blur-sm lg:px-10">
          <div className="grid h-24 grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(240px,1fr)_auto]">
            <div className="min-w-0">
              <div className="mb-4 grid grid-cols-4 gap-2 md:hidden">
                {navItems.slice(0, 4).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      className={cn(
                        "rounded-xl p-3",
                        activePage === item.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary",
                      )}
                    >
                      <Icon className="mx-auto h-5 w-5" />
                    </button>
                  );
                })}
              </div>
              <h1 className="break-words text-3xl font-bold text-foreground lg:text-4xl">
                {titles[activePage]}
              </h1>
              <p className="mt-1 text-xl text-muted-foreground">
                {formatDate()}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative hidden lg:block">
                <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Tìm kiếm..."
                  className="h-14 w-[min(28vw,460px)] rounded-2xl border border-input bg-secondary pl-14 pr-5 text-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button className="relative rounded-2xl p-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <Bell className="h-7 w-7" />
                {alertCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-sm font-bold text-destructive-foreground">
                    {alertCount}
                  </span>
                )}
              </button>
              <button className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-7 w-7" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10">
          {activePage === "overview" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <StatCard
                  title="Nhiệt độ"
                  value={temperature.toFixed(1)}
                  unit="°C"
                  icon={Thermometer}
                  status={temperature >= 35 ? "warning" : "normal"}
                />
                <StatCard
                  title="Độ ẩm"
                  value={humidity}
                  unit="%"
                  icon={Droplets}
                />
                <StatCard
                  title="Khí Gas 1"
                  value={gas}
                  unit="ppm"
                  icon={Flame}
                  status={sensorStatus(gas, 200, 300)}
                />
                <StatCard
                  title="Khí Gas 2"
                  value={gasTwo}
                  unit="ppm"
                  icon={Flame}
                  status={sensorStatus(gasTwo, 200, 300)}
                />
              </div>
              <DoorCameraCard doorOpen={store.doorOpen} streamUrl={streamUrl} />
            </div>
          )}

          {activePage === "sensors" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <StatCard
                  title="Nhiệt độ ESP32"
                  value={temperature.toFixed(1)}
                  unit="°C"
                  icon={Thermometer}
                  status={temperature >= 35 ? "warning" : "normal"}
                />
                <StatCard
                  title="Độ ẩm ESP32"
                  value={humidity}
                  unit="%"
                  icon={Droplets}
                />
                <StatCard
                  title="WC Sensor"
                  value={
                    store.sensors.wc.distance === -1
                      ? "Out"
                      : store.sensors.wc.distance
                  }
                  unit={store.sensors.wc.distance === -1 ? undefined : "cm"}
                  icon={Gauge}
                />
                <StatCard
                  title="Kitchen Sensor"
                  value={
                    store.sensors.kitchen.distance === -1
                      ? "Out"
                      : store.sensors.kitchen.distance
                  }
                  unit={
                    store.sensors.kitchen.distance === -1 ? undefined : "cm"
                  }
                  icon={Gauge}
                />
              </div>
              <div className="rounded-xl border border-border bg-card p-8">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Khoảng cách cảm biến</h2>
                    <p className="text-xl text-muted-foreground">
                      Dữ liệu gần nhất
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={distanceChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="wc"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="kitchen"
                      stroke="var(--chart-2)"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activePage === "lights" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <LightCard
                id="bedroom"
                name="Đèn phòng ngủ"
                room="Phòng ngủ chính"
                enabled={store.leds.bedroom}
                onToggle={toggleLight}
                busy={!!lightBusy.bedroom}
              />
              <LightCard
                id="kitchen"
                name="Đèn phòng bếp"
                room="Phòng bếp"
                enabled={store.leds.kitchen}
                autoMode={store.autoLed.kitchen}
                threshold={store.ledThresholds.kitchen}
                onToggle={toggleLight}
                onAutoChange={(checked) => setAutoMode("kitchen", checked)}
                onThresholdChange={(value) =>
                  store.setLedThreshold("kitchen", value)
                }
                busy={!!lightBusy.kitchen}
              />
              <LightCard
                id="wc"
                name="Đèn phòng vệ sinh"
                room="Phòng vệ sinh"
                enabled={store.leds.wc}
                autoMode={store.autoLed.wc}
                threshold={store.ledThresholds.wc}
                onToggle={toggleLight}
                onAutoChange={(checked) => setAutoMode("wc", checked)}
                onThresholdChange={(value) =>
                  store.setLedThreshold("wc", value)
                }
                busy={!!lightBusy.wc}
              />
            </div>
          )}

          {activePage === "camera" && (
            <div className="space-y-8">
              <DoorCameraCard doorOpen={store.doorOpen} streamUrl={streamUrl} />
              <div className="rounded-xl border border-border bg-card p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Nhận diện camera</h2>
                    <p className="mt-2 text-lg text-muted-foreground">
                      {recognitionStatus?.running
                        ? "Đang tự động chụp và so sánh với dataset"
                        : "Camera monitor chưa chạy"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-5 py-2 text-lg font-bold",
                      recognitionStatus?.door_allowed
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {recognitionStatus?.door_allowed ? "TRUE" : "FALSE"}
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Kết quả</p>
                    <p className="mt-1 text-xl font-semibold">
                      {recognitionStatus?.classification ?? "idle"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Chủ nhà</p>
                    <p className="mt-1 text-xl font-semibold">
                      {recognitionStatus?.identity ?? "Không xác định"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Cập nhật</p>
                    <p className="mt-1 text-xl font-semibold">
                      {recognitionStatus?.updated_at
                        ? new Date(
                            recognitionStatus.updated_at,
                          ).toLocaleTimeString("vi-VN")
                        : "--"}
                    </p>
                  </div>
                </div>
                {recognitionStatus?.error && (
                  <p className="mt-5 rounded-xl bg-destructive/10 p-4 text-destructive">
                    {recognitionStatus.error}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold">Điều khiển cửa</h2>
                <p className="mt-2 text-lg text-muted-foreground">
                  {store.doorOpen ? "Cửa đang mở" : "Cửa đang đóng"}
                </p>
                <Button
                  className="mt-8 h-14 rounded-2xl px-8 text-lg"
                  variant="outline"
                  onClick={() =>
                    sensorApi
                      .setDoor(!store.doorOpen)
                      .then(() => store.setDoorState(!store.doorOpen))
                  }
                >
                  {store.doorOpen ? "Đóng cửa" : "Mở cửa"}
                </Button>
              </div>
            </div>
          )}

          {activePage === "face-id" && <FaceIdPanel />}

          {activePage === "speakers" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-7">
                <h3 className="text-2xl font-bold">Loa phòng khách</h3>
                <p className="mt-1 text-lg text-muted-foreground">
                  Âm lượng hệ thống
                </p>
                <div className="mt-8 flex justify-between text-lg">
                  <span>Âm lượng</span>
                  <span>{speakerOne}%</span>
                </div>
                <Slider
                  className="mt-4"
                  value={[speakerOne]}
                  onValueChange={([value]) => setSpeakerOne(value)}
                />
              </div>
              <div className="rounded-xl border border-border bg-card p-7">
                <h3 className="text-2xl font-bold">Loa cảnh báo</h3>
                <p className="mt-1 text-lg text-muted-foreground">
                  Dùng cho cảnh báo gas
                </p>
                <div className="mt-8 flex justify-between text-lg">
                  <span>Âm lượng</span>
                  <span>{speakerTwo}%</span>
                </div>
                <Slider
                  className="mt-4"
                  value={[speakerTwo]}
                  onValueChange={([value]) => setSpeakerTwo(value)}
                />
              </div>
            </div>
          )}

          {activePage === "alerts" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold">Cài đặt ngưỡng cảnh báo</h2>
                <div className="mt-8 space-y-6">
                  <div className="flex items-center justify-between rounded-xl border border-border p-6">
                    <div>
                      <h3 className="text-2xl font-semibold">
                        Cảnh báo khí gas
                      </h3>
                      <p className="text-lg text-muted-foreground">
                        Phát cảnh báo khi nồng độ gas vượt ngưỡng
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-xl text-muted-foreground">
                      <span>Ngưỡng: {store.gasThreshold} ppm</span>
                      <Switch checked />
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold">Lịch sử cảnh báo</h2>
                <div className="mt-6 space-y-4">
                  {store.events.length === 0 ? (
                    <p className="text-muted-foreground">
                      Chưa có sự kiện nào.
                    </p>
                  ) : (
                    store.events.slice(0, 6).map((event, index) => (
                      <div
                        key={`${event.timestamp}-${index}`}
                        className="flex items-center gap-5 rounded-xl border border-warning/30 bg-warning/5 p-4"
                      >
                        <span className="text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString(
                            "vi-VN",
                          )}
                        </span>
                        <span className="rounded bg-warning/20 px-3 py-1 text-sm font-semibold text-warning">
                          {event.type}
                        </span>
                        <span className="text-foreground">{event.action}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activePage === "settings" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold">Kết nối MQTT</h2>
                <div className="mt-8 space-y-6">
                  <label className="block text-lg text-muted-foreground">
                    MQTT Broker
                  </label>
                  <input
                    className="h-16 w-full rounded-2xl border border-input bg-secondary px-6 text-2xl text-foreground"
                    defaultValue="192.168.1.100"
                  />
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="text-lg text-muted-foreground">
                        Port
                      </label>
                      <input
                        className="mt-2 h-16 w-full rounded-2xl border border-input bg-secondary px-6 text-2xl text-foreground"
                        defaultValue="1883"
                      />
                    </div>
                    <div>
                      <label className="text-lg text-muted-foreground">
                        Topic
                      </label>
                      <input
                        className="mt-2 h-16 w-full rounded-2xl border border-input bg-secondary px-6 text-2xl text-foreground"
                        defaultValue="smarthome/#"
                      />
                    </div>
                  </div>
                  <Button className="h-14 rounded-2xl px-8 text-lg">
                    Lưu cài đặt
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold">Gas Analytics</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={gasChartData}>
                    <defs>
                      <linearGradient id="gasFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="var(--warning)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--warning)"
                          stopOpacity={0.03}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="gas"
                      fill="url(#gasFill)"
                      stroke="var(--warning)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
