"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Lightbulb } from "lucide-react";

interface UltrasonicLedCardProps {
  title: string;
  sensorName: string;
  distance: number;
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
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-5 text-accent" />
          {title}
        </CardTitle>
        <CardDescription>
          {sensorName}: {distance === -1 ? "out of range" : `${distance} cm`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
          <div>
            <p className="font-semibold">Auto Mode</p>
            <p className="text-xs text-muted-foreground">
              {autoMode ? "Sensor controls the light" : "Manual mode"}
            </p>
          </div>
          <Switch
            checked={autoMode}
            onCheckedChange={onAutoModeChange}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {autoMode && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trigger distance</span>
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
              LED turns ON when distance is below {threshold} cm.
            </p>
            {distance !== -1 && distance < threshold && (
              <div className="rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                Within range - LED should be ON
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
