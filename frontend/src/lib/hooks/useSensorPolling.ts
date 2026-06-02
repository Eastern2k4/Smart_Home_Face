import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { sensorApi } from "@/lib/api/sensors";

function firstDefined<T>(...values: Array<T | undefined>): T | null {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return null;
}

export function useSensorPolling() {
  const store = useStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        // 1. Fetch all sensor data
        const rawSensors = await sensorApi.getAllSensors();
        const sensors = {
          livingRoom: {
            humidity: firstDefined(
              rawSensors.livingRoom?.humidity ??
                rawSensors.humidity ??
                rawSensors.hum,
            ),
          },
          bedroom: {
            humidity: firstDefined(
              rawSensors.bedroom?.humidity ??
                rawSensors.bedroomHumidity,
            ),
          },
          kitchen: {
            distance:
              rawSensors.kitchen?.distance ??
              rawSensors.kitchenDistance ??
              0,
          },
          wc: {
            distance:
              rawSensors.wc?.distance ??
              rawSensors.wcDistance ??
              0,
          },
          gas: rawSensors.gas ?? rawSensors.gasValue ?? 0,
        };
        store.setSensors(sensors);

        // 2. Fetch device states (LEDs + door)
        const devices = await sensorApi.getDevices();
        store.setDoorState(devices.doorOpen);

        // 3. Update local store with current LED states (sync)
        store.setLedState("wc", devices.wcLight ?? false);
        store.setLedState("kitchen", devices.kitchenLight ?? false);
        store.setLedState("bedroom", devices.bedroomLight ?? false);

        // 4. Record readings for statistics
        store.addDistanceReading("wc", sensors.wc.distance);
        store.addDistanceReading("kitchen", sensors.kitchen.distance);
        store.addGasReading(sensors.gas);

        // 5. Gas alert client-side check
        const alertActive = sensors.gas > store.gasThreshold;
        store.setGasAlertActive(alertActive);
        if (alertActive) {
          store.addEvent({
            timestamp: new Date().toISOString(),
            type: "gas",
            value: sensors.gas,
            action: `High gas level detected: ${sensors.gas} > ${store.gasThreshold}`,
          });
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
  }, [store.pollingInterval, store.gasThreshold]); // re-run when thresholds change
}
