"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, Download, Gauge, Radio, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function StreamingAnalysisTab() {
  const store = useStore();
  const [avgDistance, setAvgDistance] = useState(0);
  const [peakGas, setPeakGas] = useState(0);

  const wcDistances = store.stats?.wcDistances ?? [];
  const kitchenDistances = store.stats?.kitchenDistances ?? [];
  const gasReadings = store.stats?.gasReadings ?? [];
  const allDistances = useMemo(
    () => [...wcDistances, ...kitchenDistances],
    [wcDistances, kitchenDistances],
  );

  useEffect(() => {
    setAvgDistance(average(allDistances));
    setPeakGas(gasReadings.length > 0 ? Math.max(...gasReadings) : 0);
  }, [allDistances, gasReadings]);

  const distanceChartData = useMemo(() => {
    const maxLength = Math.max(wcDistances.length, kitchenDistances.length);
    return Array.from({ length: maxLength }, (_, index) => ({
      name: index + 1,
      wc: wcDistances[index] ?? null,
      kitchen: kitchenDistances[index] ?? null,
    }));
  }, [wcDistances, kitchenDistances]);

  const gasChartData = useMemo(
    () =>
      gasReadings.map((value, index) => ({
        name: index + 1,
        value,
      })),
    [gasReadings],
  );

  const handleExportCSV = () => {
    const csv = [
      ["Timestamp", "Type", "Value", "Action"],
      ...store.events.map((e) => [
        new Date(e.timestamp).toLocaleString(),
        e.type,
        e.value,
        e.action,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-home-events-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Average distance</p>
            <Gauge className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">{avgDistance} cm</p>
          <p className="mt-1 text-xs text-muted-foreground">WC and kitchen combined</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Peak gas level</p>
            <AlertCircle className="size-5 text-accent" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">{peakGas} ppm</p>
          <p className="mt-1 text-xs text-muted-foreground">Highest recent ADC value</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Events logged</p>
            <Radio className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">{store.events.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Latest activity, max 50 rows</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Distance Trends</CardTitle>
            <CardDescription>Last 20 readings from WC and kitchen sensors</CardDescription>
          </CardHeader>
          <CardContent>
            {distanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={distanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Line type="monotone" dataKey="wc" name="WC" stroke="var(--primary)" dot={false} strokeWidth={3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="kitchen" name="Kitchen" stroke="var(--chart-2)" dot={false} strokeWidth={3} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/50 text-sm text-muted-foreground">
                Waiting for distance data
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Gas Readings</CardTitle>
            <CardDescription>Recent gas sensor ADC values</CardDescription>
          </CardHeader>
          <CardContent>
            {gasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={gasChartData}>
                  <defs>
                    <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--warning)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Area type="monotone" dataKey="value" fill="url(#gasGradient)" stroke="var(--warning)" strokeWidth={3} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/50 text-sm text-muted-foreground">
                Waiting for gas data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>Recent device actions and sensor events</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={store.events.length === 0} className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button size="sm" variant="outline" onClick={() => store.clearEvents()} disabled={store.events.length === 0} className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {store.events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No events recorded yet
                    </td>
                  </tr>
                ) : (
                  store.events.map((event, idx) => (
                    <tr key={`${event.timestamp}-${idx}`} className="transition-colors hover:bg-secondary/60">
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {event.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold">{event.value}</td>
                      <td className="px-4 py-3 text-muted-foreground">{event.action}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Polling Settings</CardTitle>
          <CardDescription>Control how often sensor data is refreshed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium">Sensor poll interval</label>
            <Badge variant="outline">{store.pollingInterval.toFixed(1)}s</Badge>
          </div>
          <Slider value={[store.pollingInterval]} onValueChange={(value) => store.setPollingInterval(value[0])} min={1} max={5} step={0.5} />
          <p className="text-xs text-muted-foreground">Lower values feel more live; higher values reduce device/network load.</p>
        </CardContent>
      </Card>
    </div>
  );
}
