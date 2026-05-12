"use client";
import { useStore } from "@/lib/store";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useAutoLED } from "@/lib/hooks/useAutoLED";
import { sensorApi } from "@/lib/api/sensors";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Zap, Activity } from "lucide-react";
import { UltrasonicLedCard } from "@/components/ultrasonic-led-card";

export function ControlCenterTab() {
  const store = useStore();
  useSensorPolling();
  useAutoLED();

  const wcDistance = store.sensors.wc.distance;
  const kitchenDistance = store.sensors.kitchen.distance;

  const wcLedAuto = store.autoLed.wc;
  const wcLedThreshold = store.ledThresholds.wc;
  const setWcLedAuto = (val: boolean) => store.setAutoLed("wc", val);
  const setWcLedThreshold = (val: number) => store.setLedThreshold("wc", val);

  const kitchenLedAuto = store.autoLed.kitchen;
  const kitchenLedThreshold = store.ledThresholds.kitchen;
  const setKitchenLedAuto = (val: boolean) => store.setAutoLed("kitchen", val);
  const setKitchenLedThreshold = (val: number) =>
    store.setLedThreshold("kitchen", val);

  const bedroomLedStatus = store.leds.bedroom;
  const gasValue = store.sensors.gas;
  const gasThreshold = store.gasThreshold;
  const gasAlertActive = store.gasAlertActive;

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
              {wcDistance === -1 ? "Out of range" : `${wcDistance} cm`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kitchen Sensor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-3xl font-bold">
              {kitchenDistance === -1
                ? "Out of range"
                : `${kitchenDistance} cm`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LED Controls - using reusable component */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UltrasonicLedCard
          title="WC Light"
          sensorName="WC Sensor"
          distance={wcDistance}
          autoMode={wcLedAuto}
          onAutoModeChange={setWcLedAuto}
          threshold={wcLedThreshold}
          onThresholdChange={setWcLedThreshold}
        />

        <UltrasonicLedCard
          title="Kitchen Light"
          sensorName="Kitchen Sensor"
          distance={kitchenDistance}
          autoMode={kitchenLedAuto}
          onAutoModeChange={setKitchenLedAuto}
          threshold={kitchenLedThreshold}
          onThresholdChange={setKitchenLedThreshold}
        />

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
                checked={bedroomLedStatus}
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
          {/* <div className="mt-4 space-y-2"> */}
          {/*   <div className="flex justify-between"> */}
          {/*     <span>Alert Threshold:</span> */}
          {/*     <span className="font-bold">{gasThreshold}</span> */}
          {/*   </div> */}
          {/*   <Slider */}
          {/*     value={[gasThreshold]} */}
          {/*     onValueChange={([v]) => store.setGasThreshold(v)} */}
          {/*     min={100} */}
          {/*     max={2000} */}
          {/*     step={50} */}
          {/*   /> */}
          {/*   <p className="text-xs text-muted-foreground"> */}
          {/*     Client‑side alert when gas value exceeds threshold */}
          {/*   </p> */}
          {/* </div> */}
        </CardContent>
      </Card>
    </div>
  );
}
