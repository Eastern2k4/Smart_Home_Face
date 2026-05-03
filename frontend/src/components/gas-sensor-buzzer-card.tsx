'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, CheckCircle2, Volume2, Loader, Clock } from 'lucide-react';
import { getGasSensorReading, triggerBuzzer, muteBuzzer } from '@/lib/api-mocks';

export function GasSensorBuzzerCard() {
  const [ppm, setPpm] = useState<number | null>(null);
  const [level, setLevel] = useState<'safe' | 'warning' | 'alert' | null>(null);
  const [loading, setLoading] = useState(false);
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [muteTimeRemaining, setMuteTimeRemaining] = useState(0);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollSensor = async () => {
      setLoading(true);
      try {
        const reading = await getGasSensorReading();
        setPpm(reading.ppm);
        setLevel(reading.level);

        // Trigger buzzer if alert level
        if (reading.level === 'alert' && !buzzerActive && muteTimeRemaining === 0) {
          setBuzzerActive(true);
          await triggerBuzzer(500);
        }
      } finally {
        setLoading(false);
      }
    };

    pollSensor();
    const interval = setInterval(pollSensor, 2500);
    return () => clearInterval(interval);
  }, [buzzerActive, muteTimeRemaining]);

  const handleMuteBuzzer = async () => {
    await muteBuzzer();
    setBuzzerActive(false);
    setMuteTimeRemaining(30);

    if (muteTimerRef.current) {
      clearInterval(muteTimerRef.current);
    }

    muteTimerRef.current = setInterval(() => {
      setMuteTimeRemaining(prev => {
        if (prev <= 1) {
          if (muteTimerRef.current) {
            clearInterval(muteTimerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (muteTimerRef.current) {
        clearInterval(muteTimerRef.current);
      }
    };
  }, []);

  const getLevelInfo = (lvl: 'safe' | 'warning' | 'alert' | null) => {
    switch (lvl) {
      case 'safe':
        return {
          icon: CheckCircle2,
          color: 'text-accent',
          bg: 'bg-accent/10 border-accent',
          label: 'Safe',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10 border-yellow-500',
          label: 'Warning',
        };
      case 'alert':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          bg: 'bg-destructive/10 border-destructive',
          label: 'Alert',
        };
      default:
        return {
          icon: Loader,
          color: 'text-muted-foreground',
          bg: 'bg-muted/10',
          label: 'Loading',
        };
    }
  };

  const info = getLevelInfo(level);
  const Icon = info.icon;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Gas Sensor & Buzzer</CardTitle>
        <CardDescription>Air quality monitoring and alarm system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gas Level Display */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${info.color}`} />
            <label className="text-sm font-medium">Gas Level (PPM)</label>
          </div>
          <div className={`glass-sm p-6 text-center border ${info.bg}`}>
            {loading ? (
              <Loader className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            ) : ppm !== null ? (
              <>
                <div className={`text-4xl font-bold ${info.color}`}>{ppm}</div>
                <div className="text-xs text-muted-foreground mt-1">PPM</div>
                <div className={`text-xs mt-2 ${info.color}`}>{info.label}</div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">No reading</div>
            )}
          </div>
        </div>

        {/* Buzzer Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Volume2 className={`w-4 h-4 ${buzzerActive ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
            <label className="text-sm font-medium">Alarm Control</label>
          </div>
          {buzzerActive && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-3 text-center">
              <p className="text-sm font-semibold text-destructive">Alarm Active!</p>
            </div>
          )}
          {muteTimeRemaining > 0 ? (
            <div className="glass-sm p-3 text-center border border-primary/50">
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <Clock className="w-4 h-4" />
                Muted for {muteTimeRemaining}s
              </div>
            </div>
          ) : (
            <Button
              onClick={handleMuteBuzzer}
              disabled={!buzzerActive}
              variant={buzzerActive ? 'default' : 'outline'}
              className="w-full gap-2"
            >
              <Volume2 className="w-4 h-4" />
              {buzzerActive ? 'Mute Alarm' : 'Alarm Off'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
