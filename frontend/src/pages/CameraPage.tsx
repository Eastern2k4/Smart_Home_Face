// src/pages/CameraPage.tsx
import { DoorCameraCard } from "@/components/DoorCameraCard";
import { useCameraStream } from "@/lib/hooks/useCameraStream";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { sensorApi } from "@/lib/api/sensors";

export function CameraPage() {
  const store = useStore();
  const streamUrl = useCameraStream();

  return (
    <div className="space-y-8">
      <DoorCameraCard doorOpen={store.doorOpen} streamUrl={streamUrl} />
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
