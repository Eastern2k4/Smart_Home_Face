// src/components/DoorCameraCard.tsx
import { Camera, DoorClosed, DoorOpen, Video } from "lucide-react";

export function DoorCameraCard({
  doorOpen,
  streamUrl,
  cameraSource = "unknown",
}: {
  doorOpen: boolean;
  streamUrl: string;
  cameraSource?: "esp32" | "laptop" | "unknown";
}) {
  const sourceLabel =
    cameraSource === "laptop"
      ? "Laptop camera"
      : cameraSource === "esp32"
        ? "ESP32-CAM"
        : "Camera";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-success/10 p-3">
            <Camera className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-foreground">
              {sourceLabel} - Cửa ra vào
            </h3>
            <p className={streamUrl ? "text-success" : "text-muted-foreground"}>
              {streamUrl ? "Trực tuyến" : "Đang chờ camera"}
            </p>
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
              alt={`${sourceLabel} stream`}
              className="aspect-square w-[420px] object-contain rounded-xl bg-black"
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
          {streamUrl ? "LIVE" : "OFFLINE"}
        </span>
        <span className="rounded bg-background px-3 py-1 text-xs font-bold">
          {cameraSource === "laptop"
            ? "LAPTOP"
            : cameraSource === "esp32"
              ? "ESP32"
              : "UNKNOWN"}
        </span>
        <span className="rounded bg-background px-3 py-1 text-xs font-bold">
          {doorOpen ? "DOOR OPEN" : "DOOR CLOSED"}
        </span>
      </div>
    </div>
  );
}
