// src/pages/AlertsPage.tsx
import { useStore } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import { faceApi } from "@/lib/api/face";
import { sensorApi } from "@/lib/api/sensors";
import { useEffect, useRef, useState } from "react";

type DeviceStatus = {
  speakers?: {
    front_door?: { active?: boolean; reason?: string | null };
    house_gas?: { active?: boolean; reason?: string | null };
  };
  alarmTriggers?: {
    stranger?: boolean;
    gas?: boolean;
    temperature?: boolean;
    humidity?: boolean;
  };
};

export function AlertsPage() {
  const store = useStore();
  const lastEventRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<DeviceStatus | null>(null);

  useEffect(() => {
    const fetchRecognitionStatus = () => {
      faceApi
        .getRecognitionStatus()
        .then((status) => {
          if (!status.event_id || status.event_id === lastEventRef.current) return;
          lastEventRef.current = status.event_id;

          if (status.event_type === "stranger_alert") {
            store.addEvent({
              timestamp: new Date().toISOString(),
              type: "buzzer",
              value: status.stranger_scan_count ?? 5,
              action:
                status.event_message ||
                "ALERT - Stranger detected on scan 5",
            });
          }
        })
        .catch((error) =>
          console.error("Failed to load recognition alert status", error),
        );
    };

    fetchRecognitionStatus();
    const interval = window.setInterval(fetchRecognitionStatus, 3000);
    return () => window.clearInterval(interval);
  }, [store]);

  useEffect(() => {
    const fetchDevices = () => {
      sensorApi
        .getDevices()
        .then((data) => setDevices(data))
        .catch((error) => console.error("Failed to load device status", error));
    };

    fetchDevices();
    const interval = window.setInterval(fetchDevices, 3000);
    return () => window.clearInterval(interval);
  }, []);

  const frontDoor = devices?.speakers?.front_door;
  const houseGas = devices?.speakers?.house_gas;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Nguồn cảnh báo</h2>
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-border p-6">
            <div>
              <h3 className="text-2xl font-semibold">Stranger face alert</h3>
              <p className="text-lg text-muted-foreground">
                Source: backend recognition - speaker: front_door
              </p>
            </div>
            <div className="flex items-center gap-6 text-xl text-muted-foreground">
              <span>{frontDoor?.reason ?? "No active reason"}</span>
              <Switch checked={!!frontDoor?.active} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-6">
            <div>
              <h3 className="text-2xl font-semibold">Canh bao moi truong</h3>
              <p className="text-lg text-muted-foreground">
                Source: ESP32 gas, temperature, humidity sensors - speaker:
                house_gas
              </p>
            </div>
            <div className="flex items-center gap-6 text-xl text-muted-foreground">
              <span>Threshold: {store.gasThreshold} ppm</span>
              <span>{houseGas?.reason ?? "No active reason"}</span>
              <Switch checked={!!houseGas?.active} />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Lịch sử cảnh báo</h2>
        <div className="mt-6 space-y-4">
          {store.events.length === 0 ? (
            <p className="text-muted-foreground">Chưa có sự kiện nào.</p>
          ) : (
            store.events.slice(0, 6).map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className="flex items-center gap-5 rounded-xl border border-warning/30 bg-warning/5 p-4"
              >
                <span className="text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString("vi-VN")}
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
  );
}

export default AlertsPage;
