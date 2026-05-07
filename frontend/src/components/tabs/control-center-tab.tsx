"use client";
import { useStore } from "@/lib/store";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useMuteTimer } from "@/lib/hooks/useMuteTimer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gauge, Zap, Volume2, Clock, Activity, Settings } from "lucide-react";

export function ControlCenterTab() {
  const store = useStore();
  useSensorPolling();
  useMuteTimer();

  const handleManualLed = async (ledId: string, checked: boolean) => {
    await sensorApi.toggleLED(ledId, checked);
    store.setLedStatus(ledId, checked);
    const led = store.leds.find((l) => l.id === ledId);
    store.addEvent({
      timestamp: new Date().toISOString(),
      type: "led",
      value: checked ? 1 : 0,
      action: `${led?.name} manually turned ${checked ? "ON" : "OFF"}`,
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

  // Group LEDs by ultrasonic sensor
  const ultrasonic1Leds = store.leds.filter(
    (led) => led.ultrasonicId === "ultrasonic1",
  );
  const ultrasonic2Leds = store.leds.filter(
    (led) => led.ultrasonicId === "ultrasonic2",
  );

  return (
    <div className="space-y-6">
      {/* Ultrasonic Sensors Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📡 Ultrasonic Sensor 1</CardTitle>
            <CardDescription>Toilet sensor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-3xl font-bold">
              {store.distance1} cm
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📡 Ultrasonic Sensor 2</CardTitle>
            <CardDescription>Kitchen sensor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-3xl font-bold">
              {store.distance2} cm
            </div>
          </CardContent>
        </Card>
      </div>
      {/* LED Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ultrasonic 1 - LED 1 */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Activity className="inline mr-2" /> LED 1 - Toilet Sensor
            </CardTitle>
            <CardDescription>
              Current distance: {store.distance1} cm
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Auto Mode</span>
              <Switch
                checked={store.leds[0].autoMode}
                onCheckedChange={(checked) =>
                  store.setLedAutoMode("led1", checked)
                }
                className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300"
              />
            </div>

            {store.leds[0].autoMode && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Trigger Distance:</span>
                  <span className="font-bold">
                    {store.leds[0].threshold} cm
                  </span>
                </div>
                <Slider
                  value={[store.leds[0].threshold]}
                  onValueChange={([v]) => store.setLedThreshold("led1", v)}
                  min={5}
                  max={150}
                  step={5}
                  className="[&_[data-slot='slider-range']]:bg-green-500 [&_[data-slot='slider-thumb']]:border-green-500"
                />
                <p className="text-xs text-muted-foreground">
                  LED will turn ON when distance {"<"} {store.leds[0].threshold}{" "}
                  cm
                </p>
                {store.distance1 < store.leds[0].threshold &&
                  store.leds[0].autoMode && (
                    <div className="text-green-600 text-xs font-medium">
                      Currently within range - LED should be ON
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ultrasonic 2 - LED 2 */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Activity className="inline mr-2" /> LED 2 - Kitchen Sensor
            </CardTitle>
            <CardDescription>
              Current distance: {store.distance2} cm
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Auto Mode</span>
              <Switch
                checked={store.leds[1].autoMode}
                onCheckedChange={(checked) =>
                  store.setLedAutoMode("led2", checked)
                }
                className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300"
              />
            </div>

            {store.leds[1].autoMode && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Trigger Distance:</span>
                  <span className="font-bold">
                    {store.leds[1].threshold} cm
                  </span>
                </div>
                <Slider
                  value={[store.leds[1].threshold]}
                  onValueChange={([v]) => store.setLedThreshold("led2", v)}
                  min={5}
                  max={150}
                  step={5}
                  className="[&_[data-slot='slider-range']]:bg-blue-500 [&_[data-slot='slider-thumb']]:border-blue-500"
                />
                <p className="text-xs text-muted-foreground">
                  LED will turn ON when distance {"<"} {store.leds[1].threshold}{" "}
                  cm
                </p>
                {store.distance2 < store.leds[1].threshold &&
                  store.leds[1].autoMode && (
                    <div className="text-green-600 text-xs font-medium">
                      Currently within range - LED should be ON
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual LED 3 - Manual only */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Activity className="inline mr-2" /> LED 3 - Individual
            </CardTitle>
            <CardDescription>
              Manual control only (not connected to sensors)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">LED Control</span>
              <Switch
                checked={store.leds[2].status}
                onCheckedChange={(checked) => handleManualLed("led3", checked)}
                className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-300"
              />
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This LED is manually controlled only
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the switch above to turn it ON/OFF
              </p>
            </div>
          </CardContent>
        </Card>
      </div>{" "}
      {/* Gas & Buzzer Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Zap className="inline mr-2" /> Gas Sensor & Buzzer
          </CardTitle>
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
              <Clock className="w-4 h-4" /> Muted for {store.buzzerMuteTime}s
            </div>
          ) : (
            <Button
              onClick={handleMute}
              disabled={!store.buzzerStatus}
              className="w-full mt-2 gap-2"
            >
              <Volume2 className="w-4 h-4" /> Mute for 30s
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
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span>Gas Threshold:</span>
                <span className="font-bold">{store.gasThreshold} ppm</span>
              </div>
              <Slider
                value={[store.gasThreshold]}
                onValueChange={([v]) => store.setGasThreshold(v)}
                min={100}
                max={800}
                step={50}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
