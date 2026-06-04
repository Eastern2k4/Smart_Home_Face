// src/pages/SensorsPage.tsx
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { sensorApi } from "@/lib/api/sensors";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useStore } from "@/lib/store";
import {
  DoorClosed,
  DoorOpen,
  Droplets,
  Flame,
  Gauge,
  Thermometer,
} from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SensorsPage() {
  useSensorPolling();
  const store = useStore();
  const livingRoom = store.sensors.livingRoom;
  const bedroom = store.sensors.bedroom;

  const formatNumber = (value: number | null, digits = 1) =>
    value === null ? "Không có" : value.toFixed(digits);

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
          value={store.sensors.gas}
          unit="ppm"
          icon={Flame}
          status={store.sensors.gas >= store.gasThreshold ? "danger" : "normal"}
        />
        <StatCard
          title="Cảm biến WC"
          value={
            store.sensors.wc.distance === -1
              ? "Ngoài phạm vi"
              : store.sensors.wc.distance
          }
          unit={store.sensors.wc.distance === -1 ? undefined : "cm"}
          icon={Gauge}
        />
        <StatCard
          title="Cảm biến bếp"
          value={
            store.sensors.kitchen.distance === -1
              ? "Ngoài phạm vi"
              : store.sensors.kitchen.distance
          }
          unit={store.sensors.kitchen.distance === -1 ? undefined : "cm"}
          icon={Gauge}
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Điều khiển cửa</h2>
            <p className="mt-2 text-lg text-muted-foreground">
              {store.doorOpen ? "Cửa đang mở" : "Cửa đang đóng"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              className="h-12 px-6"
              onClick={() =>
                sensorApi.setDoor(true).then(() => store.setDoorState(true))
              }
              disabled={store.doorOpen}
            >
              <DoorOpen className="mr-2 h-5 w-5" />
              Mở cửa
            </Button>
            <Button
              className="h-12 px-6"
              variant="outline"
              onClick={() =>
                sensorApi.setDoor(false).then(() => store.setDoorState(false))
              }
              disabled={!store.doorOpen}
            >
              <DoorClosed className="mr-2 h-5 w-5" />
              Đóng cửa
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Khoảng cách cảm biến</h2>
            <p className="text-xl text-muted-foreground">Dữ liệu gần nhất</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={distanceChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
  );
}

export default SensorsPage;
