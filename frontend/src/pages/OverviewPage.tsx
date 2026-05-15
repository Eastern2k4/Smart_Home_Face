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
  const streamUrl = useCameraStream();
  const store = useStore();
  const { temperature, humidity } = store.sensors.livingRoom;
  const gas = store.sensors.gas;
  const gasTwo = Math.max(0, Math.round(gas * 0.4));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StatCard
          title="Nhiệt độ"
          value={temperature.toFixed(1)}
          unit="°C"
          icon={Thermometer}
          status={temperature >= 35 ? "warning" : "normal"}
        />
        <StatCard title="Độ ẩm" value={humidity} unit="%" icon={Droplets} />
        <StatCard
          title="Khí Gas 1"
          value={gas}
          unit="ppm"
          icon={Flame}
          status={gas >= 200 ? (gas >= 300 ? "danger" : "warning") : "normal"}
        />
        <StatCard
          title="Khí Gas 2"
          value={gasTwo}
          unit="ppm"
          icon={Flame}
          status={
            gasTwo >= 200 ? (gasTwo >= 300 ? "danger" : "warning") : "normal"
          }
        />
      </div>
      <DoorCameraCard doorOpen={store.doorOpen} streamUrl={streamUrl} />
    </div>
  );
}
