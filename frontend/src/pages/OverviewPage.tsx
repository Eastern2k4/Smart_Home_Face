// src/pages/OverviewPage.tsx
import { DoorCameraCard } from "@/components/DoorCameraCard";
import { StatCard } from "@/components/StatCard";
import { useAutoLED } from "@/lib/hooks/useAutoLED";
import { useCameraStream } from "@/lib/hooks/useCameraStream";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useStore } from "@/lib/store";
import { Droplets, Flame } from "lucide-react";

export function OverviewPage() {
  useSensorPolling();
  useAutoLED();
  const streamUrl = useCameraStream();
  const store = useStore();
  const livingRoom = store.sensors.livingRoom;
  const bedroom = store.sensors.bedroom;
  const gas = store.sensors.gas;

  const formatNumber = (value: number | null, digits = 1) =>
    value === null ? "N/A" : value.toFixed(digits);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StatCard
          title="Living Room Humidity"
          value={formatNumber(livingRoom.humidity)}
          unit={livingRoom.humidity === null ? undefined : "%"}
          icon={Droplets}
        />
        <StatCard
          title="Bedroom Humidity"
          value={formatNumber(bedroom.humidity)}
          unit={bedroom.humidity === null ? undefined : "%"}
          icon={Droplets}
        />
        <StatCard
          title="Khí Gas 1"
          value={gas}
          unit="ppm"
          icon={Flame}
          status={gas >= 200 ? (gas >= 300 ? "danger" : "warning") : "normal"}
        />
      </div>
      <DoorCameraCard doorOpen={store.doorOpen} streamUrl={streamUrl} />
    </div>
  );
}

export default OverviewPage;
