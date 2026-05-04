// lib/hooks/useSensorPolling.ts
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { sensorApi } from "@/lib/api/sensors";

export function useSensorPolling() {
  const store = useStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const poll = async () => {
      // Fetch distance
      const distReading = await sensorApi.getUltrasonic();
      store.setDistance(distReading.distance);
      store.addDistanceReading(distReading.distance);

      // Auto LED rule
      if (
        store.ledAutoMode &&
        distReading.distance <= store.ledThreshold &&
        !store.ledStatus
      ) {
        await sensorApi.toggleLED(true);
        store.setLedStatus(true);
        store.addEvent({
          timestamp: new Date().toISOString(),
          type: "led",
          value: distReading.distance,
          action: "LED ON by auto rule",
        });
      } else if (
        store.ledAutoMode &&
        distReading.distance > store.ledThreshold &&
        store.ledStatus
      ) {
        await sensorApi.toggleLED(false);
        store.setLedStatus(false);
        store.addEvent({
          timestamp: new Date().toISOString(),
          type: "led",
          value: distReading.distance,
          action: "LED OFF by auto rule",
        });
      }

      // Fetch gas
      const gasReading = await sensorApi.getGas();
      store.setGas(gasReading.ppm);
      store.addGasReading(gasReading.ppm);

      const isAbove = gasReading.ppm > store.gasThreshold;
      const isMuted = store.buzzerMuteTime > 0;

      if (isAbove && !store.buzzerStatus && !isMuted && store.autoBuzzer) {
        store.setBuzzerStatus(true);
        await sensorApi.triggerBuzzer(500);
        store.addEvent({
          timestamp: new Date().toISOString(),
          type: "buzzer",
          value: gasReading.ppm,
          action: `Buzzer activated (${gasReading.ppm} ppm)`,
        });
      } else if (!isAbove && store.buzzerStatus) {
        store.setBuzzerStatus(false);
        store.addEvent({
          timestamp: new Date().toISOString(),
          type: "gas",
          value: gasReading.ppm,
          action: `Gas back to safe (${gasReading.ppm} ppm)`,
        });
      }
    };

    poll();
    intervalRef.current = setInterval(poll, store.pollingInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    store.pollingInterval,
    store.ledAutoMode,
    store.ledThreshold,
    store.gasThreshold,
    store.autoBuzzer,
  ]);
}
