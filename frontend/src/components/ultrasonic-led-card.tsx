'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Gauge, Zap, Loader } from 'lucide-react';
import { getUltrasonicReading, toggleLED } from '@/lib/api-mocks';

export function UltrasonicLedCard() {
  const [distance, setDistance] = useState<number | null>(null);
  const [ledState, setLedState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const pollSensor = async () => {
      setLoading(true);
      try {
        const reading = await getUltrasonicReading();
        setDistance(reading.distance);
      } finally {
        setLoading(false);
      }
    };

    pollSensor();
    const interval = setInterval(pollSensor, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleToggleLED = async (value: string) => {
    const newState = value === 'on';
    setToggling(true);
    try {
      await toggleLED(newState);
      setLedState(newState);
    } finally {
      setToggling(false);
    }
  };

  const getDistanceStatus = (dist: number) => {
    if (dist < 50) return { label: 'Very Close', color: 'text-destructive' };
    if (dist < 150) return { label: 'Close', color: 'text-primary' };
    if (dist < 300) return { label: 'Medium', color: 'text-secondary' };
    return { label: 'Far', color: 'text-muted-foreground' };
  };

  const status = distance !== null ? getDistanceStatus(distance) : null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Ultrasonic & LED</CardTitle>
        <CardDescription>Distance sensor and LED control</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distance Sensor */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <label className="text-sm font-medium">Distance Sensor</label>
          </div>
          <div className="glass-sm p-6 text-center">
            {loading ? (
              <Loader className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            ) : distance !== null ? (
              <>
                <div className={`text-4xl font-bold ${status?.color}`}>{distance}</div>
                <div className="text-xs text-muted-foreground mt-1">cm</div>
                <div className={`text-xs mt-2 ${status?.color}`}>{status?.label}</div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">No reading</div>
            )}
          </div>
        </div>

        {/* LED Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${ledState ? 'text-primary' : 'text-muted-foreground'}`} />
            <label className="text-sm font-medium">LED Control</label>
          </div>
          <ToggleGroup
            type="single"
            value={ledState ? 'on' : 'off'}
            onValueChange={handleToggleLED}
            disabled={toggling}
            className="w-full"
          >
            <ToggleGroupItem value="off" className="flex-1 glass-sm">
              Off
            </ToggleGroupItem>
            <ToggleGroupItem value="on" className="flex-1 glass-sm">
              On
            </ToggleGroupItem>
          </ToggleGroup>
          {ledState && (
            <div className="text-xs text-primary text-center mt-2">
              ● LED is active
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
