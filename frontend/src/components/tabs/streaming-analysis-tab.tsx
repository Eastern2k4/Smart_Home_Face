"use client";

import { useEffect, useState } from "react";
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
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Download, Trash2, Gauge, AlertCircle, Home } from "lucide-react";
import { useStore } from "@/lib/store";

export function StreamingAnalysisTab() {
  const store = useStore();

  // WC statistics
  const [avgWcDistance, setAvgWcDistance] = useState(0);
  const [avgKitchenDistance, setAvgKitchenDistance] = useState(0);
  const [peakGas, setPeakGas] = useState(0);

  const wcDistances = store.stats.wcDistances;
  const kitchenDistances = store.stats.kitchenDistances;
  const gasReadings = store.stats.gasReadings;

  useEffect(() => {
    // Average WC distance
    if (wcDistances.length > 0) {
      const avg = wcDistances.reduce((a, b) => a + b, 0) / wcDistances.length;
      setAvgWcDistance(Math.round(avg));
    } else {
      setAvgWcDistance(0);
    }

    // Average Kitchen distance
    if (kitchenDistances.length > 0) {
      const avg =
        kitchenDistances.reduce((a, b) => a + b, 0) / kitchenDistances.length;
      setAvgKitchenDistance(Math.round(avg));
    } else {
      setAvgKitchenDistance(0);
    }

    // Peak gas
    if (gasReadings.length > 0) {
      setPeakGas(Math.max(...gasReadings));
    } else {
      setPeakGas(0);
    }
  }, [wcDistances, kitchenDistances, gasReadings]);

  // Prepare combined distance chart data (align by index)
  const maxLength = Math.max(wcDistances.length, kitchenDistances.length);
  const distanceChartData = [];
  for (let i = 0; i < maxLength; i++) {
    distanceChartData.push({
      name: i + 1,
      wc: i < wcDistances.length ? wcDistances[i] : null,
      kitchen: i < kitchenDistances.length ? kitchenDistances[i] : null,
    });
  }

  const gasChartData = gasReadings.map((value, index) => ({
    name: index + 1,
    value,
  }));

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
      {/* Combined Distance Chart */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">
            Distance Readings (Last 20 per sensor)
          </CardTitle>
          <CardDescription>
            WC sensor (green) and Kitchen sensor (blue)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {distanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={distanceChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(79, 129, 232, 0.1)"
                />
                <XAxis
                  dataKey="name"
                  stroke="rgb(148, 163, 184)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  stroke="rgb(148, 163, 184)"
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(20, 27, 43, 0.95)",
                    border: "1px solid rgba(79, 129, 232, 0.3)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "rgb(229, 231, 235)" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="wc"
                  name="WC (cm)"
                  stroke="rgb(74, 222, 128)"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="kitchen"
                  name="Kitchen (cm)"
                  stroke="rgb(59, 130, 246)"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No distance data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gas Chart */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Gas Readings (Last 20)</CardTitle>
          <CardDescription>Raw ADC value (0–4095)</CardDescription>
        </CardHeader>
        <CardContent>
          {gasChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={gasChartData}>
                <defs>
                  <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="rgb(34, 197, 94)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="50%"
                      stopColor="rgb(243, 156, 18)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="rgb(239, 68, 68)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(79, 129, 232, 0.1)"
                />
                <XAxis
                  dataKey="name"
                  stroke="rgb(148, 163, 184)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  stroke="rgb(148, 163, 184)"
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(20, 27, 43, 0.95)",
                    border: "1px solid rgba(79, 129, 232, 0.3)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "rgb(229, 231, 235)" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Gas (ADC)"
                  fill="url(#gasGradient)"
                  stroke="rgb(243, 156, 18)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No gas data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats - Distance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              WC Distance Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Average WC Distance
              </span>
              <span className="font-semibold">{avgWcDistance} cm</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Current WC Distance
              </span>
              <span className="font-semibold">
                {store.sensors.wc.distance === -1
                  ? "Out of range"
                  : `${store.sensors.wc.distance} cm`}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Readings Recorded
              </span>
              <Badge>{wcDistances.length}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="w-4 h-4" />
              Kitchen Distance Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Average Kitchen Distance
              </span>
              <span className="font-semibold">{avgKitchenDistance} cm</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Current Kitchen Distance
              </span>
              <span className="font-semibold">
                {store.sensors.kitchen.distance === -1
                  ? "Out of range"
                  : `${store.sensors.kitchen.distance} cm`}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Readings Recorded
              </span>
              <Badge>{kitchenDistances.length}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Gas Statistics */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Gas Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Peak Gas Level
              </span>
              <span className="font-semibold">{peakGas} (ADC)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Current Gas Level
              </span>
              <span className="font-semibold">{store.sensors.gas} (ADC)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Readings Recorded
              </span>
              <Badge>{gasReadings.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Log (unchanged, already works) */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>
                Last {store.events.length} events (max 50)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                disabled={store.events.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => store.clearEvents()}
                disabled={store.events.length === 0}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/80 border-b border-border">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                    Time
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                    Value
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {store.events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No events yet
                    </td>
                  </tr>
                ) : (
                  store.events.map((event, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-card/50 transition-colors"
                    >
                      <td className="py-2 px-3 text-xs text-muted-foreground font-mono">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {event.type}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-semibold">{event.value}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {event.action}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Polling Interval Control */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Polling Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Sensor Poll Interval: {store.pollingInterval.toFixed(1)}s
              </label>
              <Badge variant="outline">
                {store.pollingInterval.toFixed(1)}s
              </Badge>
            </div>
            <Slider
              value={[store.pollingInterval]}
              onValueChange={(value) => store.setPollingInterval(value[0])}
              min={1}
              max={5}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Adjust how frequently sensor data is fetched (1s – 5s)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
