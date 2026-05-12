"use client";

import { useStore } from "@/lib/store";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useAutoLED } from "@/lib/hooks/useAutoLED";
import { sensorApi } from "@/lib/api/sensors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { BedDouble, Ruler, Waves, Zap } from "lucide-react";
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="size-5 text-primary" />
              WC Sensor
            </CardTitle>
            <CardDescription>Ultrasonic distance reading</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-secondary p-5 text-center">
              <p className="text-sm text-muted-foreground">Current distance</p>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                {wcDistance === -1 ? "Out of range" : `${wcDistance} cm`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Waves className="size-5 text-primary" />
              Kitchen Sensor
            </CardTitle>
            <CardDescription>Ultrasonic distance reading</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-secondary p-5 text-center">
              <p className="text-sm text-muted-foreground">Current distance</p>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                {kitchenDistance === -1 ? "Out of range" : `${kitchenDistance} cm`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="size-5 text-primary" />
              Bedroom Light
            </CardTitle>
            <CardDescription>Manual control only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
              <div>
                <p className="font-semibold">LED Control</p>
                <p className="text-xs text-muted-foreground">
                  {bedroomLedStatus ? "Light is on" : "Light is off"}
                </p>
              </div>
              <Switch
                checked={bedroomLedStatus}
                onCheckedChange={handleBedroomManual}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Use the switch above to turn the bedroom light on or off.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-5 text-accent" />
            Gas Sensor
          </CardTitle>
          <CardDescription>Raw ADC value (0-4095)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current gas level</p>
              <p className="mt-1 text-4xl font-bold tracking-tight">{gasValue}</p>
            </div>
            <div className="rounded-lg bg-secondary px-4 py-3 text-sm">
              Threshold <span className="font-semibold">{gasThreshold}</span>
            </div>
          </div>
          <div className="mt-5 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500" />
          {gasAlertActive && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              High gas level detected
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
