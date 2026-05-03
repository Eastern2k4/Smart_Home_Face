"use client";
import { useStore } from "@/lib/store";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useMuteTimer } from "@/lib/hooks/useMuteTimer";
import { sensorApi } from "@/lib/api/sensors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Gauge, Zap, Volume2, Clock } from "lucide-react";

export function ControlCenterTab() {
  const store = useStore();
  useSensorPolling();
  useMuteTimer();

  const handleManualLed = async (checked: boolean) => {
    await sensorApi.toggleLED(checked);
    store.setLedStatus(checked);
    store.addEvent({
      timestamp: new Date().toISOString(),
      type: "led",
      value: checked ? 1 : 0,
      action: `LED manually turned ${checked ? "ON" : "OFF"}`,
    });
  };

  const handleMute = async () => {
    await sensorApi.muteBuzzer();
    store.setBuzzerStatus(false);
    store.setBuzzerMuteTime(30);
    store.addEvent({
      timestamp: new Date().toISOString(),
      type: "buzzer",
      value: store.gas,
      action: "Buzzer muted for 30s",
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ultrasonic Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Gauge className="inline mr-2" /> Ultrasonic & LED
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-4xl font-bold">
            {store.distance} cm
          </div>
          <div className="flex justify-between items-center mt-4">
            <span>Manual LED</span>
            <Switch
              checked={store.ledStatus}
              onCheckedChange={handleManualLed}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span>Auto Mode</span>
            <Switch
              checked={store.ledAutoMode}
              onCheckedChange={store.setLedAutoMode}
            />
          </div>
          {store.ledAutoMode && (
            <>
              <div className="mt-2">Threshold: {store.ledThreshold} cm</div>
              <Slider
                value={[store.ledThreshold]}
                onValueChange={([v]) => store.setLedThreshold(v)}
                min={5}
                max={150}
                step={5}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Gas Card */}
      <Card>
        <CardHeader>
          <CardTitle>Gas Sensor & Buzzer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-4xl font-bold">{store.gas} ppm</div>
          <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
          {store.buzzerStatus && (
            <div className="bg-red-500/20 text-red-500 p-2 rounded-md mt-2 animate-pulse">
              ⚠ ALARM ACTIVE
            </div>
          )}
          {store.buzzerMuteTime > 0 ? (
            <div className="flex justify-center gap-2 mt-2">
              <Clock /> Muted for {store.buzzerMuteTime}s
            </div>
          ) : (
            <Button
              onClick={handleMute}
              disabled={!store.buzzerStatus}
              className="w-full mt-2"
            >
              <Volume2 /> Mute for 30s
            </Button>
          )}
          <div className="flex justify-between mt-2">
            <span>Auto Buzzer</span>
            <Switch
              checked={store.autoBuzzer}
              onCheckedChange={store.setAutoBuzzer}
            />
          </div>
          {store.autoBuzzer && (
            <>
              <div>Threshold: {store.gasThreshold} ppm</div>
              <Slider
                value={[store.gasThreshold]}
                onValueChange={([v]) => store.setGasThreshold(v)}
                min={100}
                max={800}
                step={50}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
