// lib/hooks/useSensorPolling.ts
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { sensorApi } from "@/lib/api/sensors";

export function useSensorPolling() {
  const store = useStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const [toiletDistance, kitchenDistance, gas, ledStatuses] =
          await Promise.all([
            sensorApi.getToiletDistance(),
            sensorApi.getKitchenDistance(),
            sensorApi.getGas(),
            sensorApi.getLEDStatuses().catch(() => ({})),
          ]);

        // Update distances (triggers auto LED rules)
        store.setToiletDistance(toiletDistance);
        store.setKitchenDistance(kitchenDistance);

        // Update gas (triggers auto buzzer logic)
        store.setGas(gas);

        // Sync LED statuses from ESP32 (only for manual LED)
        if (ledStatuses) {
          const manualLed = store.leds.find((led) => led.id === "manualLed");
          if (
            manualLed &&
            ledStatuses.manualLed !== undefined &&
            !manualLed.autoMode
          ) {
            if (ledStatuses.manualLed !== manualLed.status) {
              store.setLedStatus("manualLed", ledStatuses.manualLed);
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      } finally {
        isPollingRef.current = false;
      }
    };

    poll();
    intervalRef.current = setInterval(poll, store.pollingInterval * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [store.pollingInterval]);
}
