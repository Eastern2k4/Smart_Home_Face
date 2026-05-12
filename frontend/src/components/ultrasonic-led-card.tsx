"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Activity } from "lucide-react";

interface UltrasonicLedCardProps {
  title: string; // e.g., "WC Light"
  sensorName: string; // e.g., "WC Sensor"
  distance: number; // current distance in cm, -1 if out of range
  autoMode: boolean;
  onAutoModeChange: (val: boolean) => void;
  threshold: number;
  onThresholdChange: (val: number) => void;
}

export function UltrasonicLedCard({
  title,
  sensorName,
  distance,
  autoMode,
  onAutoModeChange,
  threshold,
  onThresholdChange,
}: UltrasonicLedCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Activity className="inline mr-2" /> {title}
        </CardTitle>
        {/* <CardDescription> */}
        {/*   Current distance:{" "} */}
        {/*   {distance === -1 ? "Out of range" : `${distance} cm`} */}
        {/* </CardDescription> */}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span>Auto Mode</span>
          <Switch
            checked={autoMode}
            onCheckedChange={onAutoModeChange}
            className="data-[state=checked]:bg-blue-500"
          />
        </div>

        {autoMode && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Trigger Distance:</span>
              <span className="font-bold">{threshold} cm</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={([v]) => onThresholdChange(v)}
              min={1}
              max={50}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              LED turns ON when distance &lt; {threshold} cm
            </p>
            {distance !== -1 && distance < threshold && autoMode && (
              <div className="text-green-600 text-xs font-medium">
                Within range – LED should be ON
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
