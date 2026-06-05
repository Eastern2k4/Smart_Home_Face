// src/pages/OverviewPage.tsx
import { DoorCameraCard } from "@/components/DoorCameraCard";
import { StatCard } from "@/components/StatCard";
import { useAutoLED } from "@/lib/hooks/useAutoLED";
import { useCameraStream } from "@/lib/hooks/useCameraStream";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useStore } from "@/lib/store";
import { Droplets, Flame, Thermometer } from "lucide-react";

export function OverviewPage() {
  useSensorPolling();
  useAutoLED();
  const { streamUrl, cameraSource } = useCameraStream();
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
          title="Nhiệt độ phòng khách"
          value={formatNumber(livingRoom.temperature)}
          unit={livingRoom.temperature === null ? undefined : "°C"}
          icon={Thermometer}
          status={
            livingRoom.temperature !== null && livingRoom.temperature >= 35
              ? "warning"
              : "normal"
          }
        />
        <StatCard
          title="Độ ẩm phòng khách"
          value={formatNumber(livingRoom.humidity)}
          unit={livingRoom.humidity === null ? undefined : "%"}
          icon={Droplets}
        />
        <StatCard
          title="Độ ẩm phòng ngủ"
          value={formatNumber(bedroom.humidity)}
          unit={bedroom.humidity === null ? undefined : "%"}
          icon={Droplets}
        />
        <StatCard
          title="Nhiệt độ phòng ngủ"
          value={formatNumber(bedroom.temperature)}
          unit={bedroom.temperature === null ? undefined : "°C"}
          icon={Thermometer}
          status={
            bedroom.temperature !== null && bedroom.temperature >= 35
              ? "warning"
              : "normal"
          }
        />
        <StatCard
          title="Khí gas"
          value={gas}
          unit="ppm"
          icon={Flame}
          status={gas >= 200 ? (gas >= 300 ? "danger" : "warning") : "normal"}
        />
      </div>
      <DoorCameraCard
        doorOpen={store.doorOpen}
        streamUrl={streamUrl}
        cameraSource={cameraSource}
      />
    </div>
  );
}

export default OverviewPage;
