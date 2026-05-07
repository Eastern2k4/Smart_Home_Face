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
        // 1. Fetch all sensor data from ESP32
        const sensors = await sensorApi.getAllSensors();
        // Expected shape: { livingRoom: {temp, hum}, bedroom: {temp, hum}, kitchen: {distance}, wc: {distance}, gas: number }
        store.setSensors(sensors);

        // 2. Fetch device states (LEDs + door)
        const devices = await sensorApi.getDevices();
        // Expected shape: { wcLight, kitchenLight, bedroomLight, doorOpen }
        store.updateAllLeds({
          wc: devices.wcLight,
          kitchen: devices.kitchenLight,
          bedroom: devices.bedroomLight,
        });
        store.setDoorState(devices.doorOpen);

        // Record readings for statistics
        store.addDistanceReading("wc", sensors.wc.distance);
        store.addDistanceReading("kitchen", sensors.kitchen.distance);
        store.addGasReading(sensors.gas);
        store.setDoorState(devices.doorOpen);

        const { leds, autoLed, ledThresholds, sensors: currentSensors } = store;

        // Check WC auto
        if (autoLed.wc) {
          const shouldOn =
            currentSensors.wc.distance < ledThresholds.wc &&
            currentSensors.wc.distance !== -1;
          if (shouldOn !== leds.wc) {
            await sensorApi.toggleLED("wc", shouldOn);
            store.setLedState("wc", shouldOn);
            store.addEvent({
              timestamp: new Date().toISOString(),
              type: "led",
              value: shouldOn ? 1 : 0,
              action: `Auto WC light ${shouldOn ? "ON" : "OFF"} (distance ${currentSensors.wc.distance}cm)`,
            });
          }
        }

        // Check Kitchen auto
        if (autoLed.kitchen) {
          const shouldOn =
            currentSensors.kitchen.distance < ledThresholds.kitchen &&
            currentSensors.kitchen.distance !== -1;
          if (shouldOn !== leds.kitchen) {
            await sensorApi.toggleLED("kitchen", shouldOn);
            store.setLedState("kitchen", shouldOn);
            store.addEvent({
              timestamp: new Date().toISOString(),
              type: "led",
              value: shouldOn ? 1 : 0,
              action: `Auto kitchen light ${shouldOn ? "ON" : "OFF"} (distance ${currentSensors.kitchen.distance}cm)`,
            });
          }
        }

        // Note: bedroom has no ultrasonic sensor, so auto not applicable.
      } catch (error) {
        console.error("Polling error:", error);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Start polling
    poll();
    intervalRef.current = setInterval(poll, store.pollingInterval * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [store.pollingInterval]); // also add store methods as dependencies? Not needed because store is stable
}
