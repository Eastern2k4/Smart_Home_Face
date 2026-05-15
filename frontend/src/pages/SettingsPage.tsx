// src/pages/SettingsPage.tsx
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SettingsPage() {
  const store = useStore();
  const gas = store.sensors.gas;
  const gasChartData = useMemo(() => {
    const readings =
      store.stats.gasReadings.length > 0
        ? store.stats.gasReadings
        : [gas, gas, gas, gas, gas, gas];
    return readings.map((value, idx) => ({ name: idx + 1, gas: value }));
  }, [store.stats.gasReadings, gas]);

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Kết nối MQTT</h2>
        <div className="mt-8 space-y-6">
          <label className="block text-lg text-muted-foreground">
            MQTT Broker
          </label>
          <input
            className="h-16 w-full rounded-2xl border border-input bg-secondary px-6 text-2xl text-foreground"
            defaultValue="192.168.1.100"
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="text-lg text-muted-foreground">Port</label>
              <input
                className="mt-2 h-16 w-full rounded-2xl border border-input bg-secondary px-6 text-2xl text-foreground"
                defaultValue="1883"
              />
            </div>
            <div>
              <label className="text-lg text-muted-foreground">Topic</label>
              <input
                className="mt-2 h-16 w-full rounded-2xl border border-input bg-secondary px-6 text-2xl text-foreground"
                defaultValue="smarthome/#"
              />
            </div>
          </div>
          <Button className="h-14 rounded-2xl px-8 text-lg">Lưu cài đặt</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Gas Analytics</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={gasChartData}>
            <defs>
              <linearGradient id="gasFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--warning)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--warning)"
                  stopOpacity={0.03}
                />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="gas"
              fill="url(#gasFill)"
              stroke="var(--warning)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default SettingsPage;
