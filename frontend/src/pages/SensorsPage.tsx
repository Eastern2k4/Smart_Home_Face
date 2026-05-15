// src/pages/SensorsPage.tsx
import { StatCard } from "@/components/StatCard";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useStore } from "@/lib/store";
import { Droplets, Gauge, Thermometer } from "lucide-react";
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
  const { temperature, humidity } = store.sensors.livingRoom;

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
            store.sensors.wc.distance === -1 ? "Out" : store.sensors.wc.distance
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
          unit={store.sensors.kitchen.distance === -1 ? undefined : "cm"}
          icon={Gauge}
        />
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
