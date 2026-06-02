// src/components/DoorCameraCard.tsx
import { Camera, DoorClosed, DoorOpen, Video } from "lucide-react";

export function DoorCameraCard({
  doorOpen,
  streamUrl,
}: {
  doorOpen: boolean;
  streamUrl: string;
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
          LIVE
        </span>
        <span className="rounded bg-background px-3 py-1 text-xs font-bold">
          {doorOpen ? "DOOR OPEN" : "DOOR CLOSED"}
        </span>
      </div>
    </div>
  );
}
