// src/pages/CameraPage.tsx
import { DoorCameraCard } from "@/components/DoorCameraCard";
import { useCameraStream } from "@/lib/hooks/useCameraStream";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { sensorApi } from "@/lib/api/sensors";
import { faceApi, RecognitionStatus } from "@/lib/api/face";
import { useEffect, useRef, useState } from "react";

export function CameraPage() {
  const store = useStore();
  const { streamUrl, cameraSource } = useCameraStream();
  const [recognitionStatus, setRecognitionStatus] =
    useState<RecognitionStatus | null>(null);
  const [recognitionNotice, setRecognitionNotice] = useState<string | null>(null);
  const lastEventRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchStatus = () => {
      faceApi
        .getRecognitionStatus()
        .then((status) => {
          setRecognitionStatus(status);

          if (!status.event_id || status.event_id === lastEventRef.current) return;
          lastEventRef.current = status.event_id;

          if (status.event_type === "host") {
            setRecognitionNotice(status.event_message || "TRUE - Host recognized");
            store.setDoorState(true);
            store.addEvent({
              timestamp: new Date().toISOString(),
              type: "door",
              value: 1,
              action: status.event_message || "Host recognized",
            });
          } else if (status.event_type === "stranger_alert") {
            setRecognitionNotice(
              status.event_message ||
                "ALERT - Stranger detected on scan 5",
            );
            store.addEvent({
              timestamp: new Date().toISOString(),
              type: "buzzer",
              value: status.stranger_scan_count ?? 5,
              action:
                status.event_message ||
                "Stranger alert: speaker triggered on scan 5",
            });
          } else if (status.event_type === "spoof_detected") {
            setRecognitionNotice(
              status.event_message || "Canh bao: phat hien khuon mat gia mao",
            );
            store.addEvent({
              timestamp: new Date().toISOString(),
              type: "buzzer",
              value: 0,
              action: status.event_message || "Spoofed face detected",
            });
          }

          if (status.classification === "stranger" || status.classification === "spoof") {
            store.setDoorState(false);
          }
        })
        .catch((error) => console.error("Failed to load recognition status", error));
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 3000);
    return () => window.clearInterval(interval);
  }, [store]);

  useEffect(() => {
    if (!recognitionNotice) return;
    const timer = window.setTimeout(() => setRecognitionNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [recognitionNotice]);

  return (
    <div className="space-y-8">
      {recognitionNotice && (
        <div
          className={`fixed right-6 top-6 z-50 max-w-[min(460px,calc(100vw-3rem))] rounded-xl border px-5 py-4 text-lg font-semibold shadow-lg ${
            recognitionNotice.startsWith("TRUE")
              ? "border-success/30 bg-success text-white"
              : "border-destructive/30 bg-destructive text-destructive-foreground"
          }`}
        >
          {recognitionNotice}
        </div>
      )}
      <DoorCameraCard
        doorOpen={store.doorOpen}
        streamUrl={streamUrl}
        cameraSource={recognitionStatus?.camera_source ?? cameraSource}
      />
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Nhan dien cua ra vao</h2>
            <p className="mt-2 text-lg text-muted-foreground">
              {recognitionStatus?.running
                ? "Dang chup anh moi 5 giay va so sanh voi database/Hosts"
                : "Monitor chua chay"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nguon camera:{" "}
              {(recognitionStatus?.camera_source ?? cameraSource) === "laptop"
                ? "Laptop camera"
                : (recognitionStatus?.camera_source ?? cameraSource) === "esp32"
                  ? "ESP32-CAM"
                  : "Chua xac dinh"}
            </p>
          </div>
          <span
            className={`rounded-full px-5 py-2 text-lg font-bold ${
              recognitionStatus?.door_allowed
                ? "bg-success/10 text-success"
                : recognitionStatus?.stranger_alert
                  ? "bg-destructive/10 text-destructive"
                  : recognitionStatus?.classification === "spoof"
                    ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {recognitionStatus?.door_allowed
              ? "HOST"
              : recognitionStatus?.stranger_alert
                ? "STRANGER ALERT"
                : recognitionStatus?.classification === "spoof"
                  ? "SPOOF"
                : recognitionStatus?.classification ?? "idle"}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Ket qua</p>
            <p className="mt-1 text-xl font-semibold">
              {recognitionStatus?.classification ?? "idle"}
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Do tin cay</p>
            <p className="mt-1 text-xl font-semibold">
              {recognitionStatus?.confidence != null
                ? `${recognitionStatus.confidence.toFixed(1)}%`
                : "--"}
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Nguoi la</p>
            <p className="mt-1 text-xl font-semibold">
              {Math.floor((recognitionStatus?.stranger_duration_seconds ?? 0) / 60)}m{" "}
              {Math.floor((recognitionStatus?.stranger_duration_seconds ?? 0) % 60)}s
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Do that khuon mat</p>
            <p className="mt-1 text-xl font-semibold">
              {recognitionStatus?.liveness_score != null
                ? `${(recognitionStatus.liveness_score * 100).toFixed(1)}%`
                : "--"}
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Cap nhat</p>
            <p className="mt-1 text-xl font-semibold">
              {recognitionStatus?.updated_at
                ? new Date(recognitionStatus.updated_at).toLocaleTimeString()
                : "--"}
            </p>
          </div>
        </div>

        {recognitionStatus?.stranger_alert && (
          <p className="mt-5 rounded-xl bg-destructive/10 p-4 text-destructive">
            Canh bao: nguoi la xuat hien lien tuc tu 5 khung hinh. Anh da duoc luu
            vao database/Strangers.
          </p>
        )}
        {recognitionStatus?.classification === "spoof" && (
          <p className="mt-5 rounded-xl bg-destructive/10 p-4 text-destructive">
            Canh bao: khuon mat khong vuot qua kiem tra chong gia mao. Khong
            mo cua va khong tinh la nguoi la.
          </p>
        )}
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
  );
}

export default CameraPage;
