"use client";
import { useStore } from "@/lib/store";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { sensorApi } from "@/lib/api/sensors";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Gauge, Zap, Activity } from "lucide-react";

export function ControlCenterTab() {
  const store = useStore();
  useSensorPolling();

  const distance1 = store.sensors.wc.distance;
  const distance2 = store.sensors.kitchen.distance;

  const led1Auto = store.autoLed.wc;
  const led1Threshold = store.ledThresholds.wc;
  const setLed1Auto = (val: boolean) => store.setAutoLed("wc", val);
  const setLed1Threshold = (val: number) => store.setLedThreshold("wc", val);

  const led2Auto = store.autoLed.kitchen;
  const led2Threshold = store.ledThresholds.kitchen;
  const setLed2Auto = (val: boolean) => store.setAutoLed("kitchen", val);
  const setLed2Threshold = (val: number) =>
    store.setLedThreshold("kitchen", val);

  const led3Status = store.leds.bedroom;
  const gasValue = store.sensors.gas;
  const gasThreshold = store.gasThreshold;
  const gasAlertActive = store.gasAlertActive;

  // Manual LED controls – direct calls, no mapping
  const handleWcManual = async (checked: boolean) => {
    await sensorApi.toggleLED("wc", checked);
    store.setLedState("wc", checked);
    store.addEvent({
      timestamp: new Date().toISOString(),
      type: "led",
      value: checked ? 1 : 0,
      action: `WC light manually turned ${checked ? "ON" : "OFF"}`,
    });
  };

  const handleKitchenManual = async (checked: boolean) => {
    await sensorApi.toggleLED("kitchen", checked);
    store.setLedState("kitchen", checked);
    store.addEvent({
      timestamp: new Date().toISOString(),
      type: "led",
      value: checked ? 1 : 0,
      action: `Kitchen light manually turned ${checked ? "ON" : "OFF"}`,
    });
  };

  const handleBedroomManual = async (checked: boolean) => {
    await sensorApi.toggleLED("bedroom", checked);
    store.setLedState("bedroom", checked);
    store.addEvent({
      timestamp: new Date().toISOString(),
      type: "led",
      value: checked ? 1 : 0,
      action: `Bedroom light manually turned ${checked ? "ON" : "OFF"}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Ultrasonic Sensors Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WC Sensor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-3xl font-bold">
              {distance1 === -1 ? "Out of range" : `${distance1} cm`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kitchen Sensor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-3xl font-bold">
              {distance2 === -1 ? "Out of range" : `${distance2} cm`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LED Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* WC Light */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Activity className="inline mr-2" /> WC Light
            </CardTitle>
            <CardDescription>Current distance: {distance1} cm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Auto Mode</span>
              <Switch
                checked={led1Auto}
                onCheckedChange={setLed1Auto}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>

            {led1Auto && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Trigger Distance:</span>
                  <span className="font-bold">{led1Threshold} cm</span>
                </div>
                <Slider
                  value={[led1Threshold]}
                  onValueChange={([v]) => setLed1Threshold(v)}
                  min={5}
                  max={150}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  LED turns ON when distance &lt; {led1Threshold} cm
                </p>
                {distance1 < led1Threshold && distance1 !== -1 && led1Auto && (
                  <div className="text-green-600 text-xs font-medium">
                    Within range – LED should be ON
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Manual Override</span>
              <Switch
                checked={store.leds.wc}
                onCheckedChange={handleWcManual}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Kitchen Light */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Activity className="inline mr-2" /> Kitchen Light
            </CardTitle>
            <CardDescription>Current distance: {distance2} cm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Auto Mode</span>
              <Switch
                checked={led2Auto}
                onCheckedChange={setLed2Auto}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>

            {led2Auto && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Trigger Distance:</span>
                  <span className="font-bold">{led2Threshold} cm</span>
                </div>
                <Slider
                  value={[led2Threshold]}
                  onValueChange={([v]) => setLed2Threshold(v)}
                  min={5}
                  max={150}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  LED turns ON when distance &lt; {led2Threshold} cm
                </p>
                {distance2 < led2Threshold && distance2 !== -1 && led2Auto && (
                  <div className="text-green-600 text-xs font-medium">
                    Within range – LED should be ON
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Manual Override</span>
              <Switch
                checked={store.leds.kitchen}
                onCheckedChange={handleKitchenManual}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bedroom Light (Manual only) */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Activity className="inline mr-2" /> Bedroom Light
            </CardTitle>
            <CardDescription>Manual control only (no sensor)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">LED Control</span>
              <Switch
                checked={led3Status}
                onCheckedChange={handleBedroomManual}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This light is manually controlled only
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the switch above to turn it ON/OFF
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gas Sensor Card (client-side alert only) */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Zap className="inline mr-2" /> Gas Sensor
          </CardTitle>
          <CardDescription>Raw ADC value (0–4095)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-4xl font-bold">{gasValue}</div>
          <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
          {gasAlertActive && (
            <div className="bg-red-500/20 text-red-500 p-2 rounded-md mt-2 animate-pulse">
              ⚠ HIGH GAS LEVEL DETECTED
            </div>
          )}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span>Alert Threshold:</span>
              <span className="font-bold">{gasThreshold}</span>
            </div>
            <Slider
              value={[gasThreshold]}
              onValueChange={([v]) => store.setGasThreshold(v)}
              min={100}
              max={2000}
              step={50}
            />
            <p className="text-xs text-muted-foreground">
              Client‑side alert when gas value exceeds threshold
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
