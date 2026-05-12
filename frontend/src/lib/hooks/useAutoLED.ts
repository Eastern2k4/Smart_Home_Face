import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { sensorApi } from "@/lib/api/sensors";

export function useAutoLED() {
  const store = useStore();
  const { autoLed, ledThresholds, sensors, leds } = store;

  // WC automation
  useEffect(() => {
    if (!autoLed.wc) return;
    const distance = sensors.wc.distance;
    if (distance === -1) return;

    const shouldBeOn = distance < ledThresholds.wc;
    if (shouldBeOn !== leds.wc) {
      sensorApi.toggleLED("wc", shouldBeOn);
      store.setLedState("wc", shouldBeOn);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "led",
        value: shouldBeOn ? 1 : 0,
        action: `Auto WC light ${shouldBeOn ? "ON" : "OFF"} (distance ${distance}cm < ${ledThresholds.wc}cm)`,
      });
    }
  }, [autoLed.wc, sensors.wc.distance, ledThresholds.wc, leds.wc]);

  // Kitchen automation
  useEffect(() => {
    if (!autoLed.kitchen) return;
    const distance = sensors.kitchen.distance;
    if (distance === -1) return;

    const shouldBeOn = distance < ledThresholds.kitchen;
    if (shouldBeOn !== leds.kitchen) {
      sensorApi.toggleLED("kitchen", shouldBeOn);
      store.setLedState("kitchen", shouldBeOn);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "led",
        value: shouldBeOn ? 1 : 0,
        action: `Auto kitchen light ${shouldBeOn ? "ON" : "OFF"} (distance ${distance}cm < ${ledThresholds.kitchen}cm)`,
      });
    }
  }, [
    autoLed.kitchen,
    sensors.kitchen.distance,
    ledThresholds.kitchen,
    leds.kitchen,
  ]);
}
