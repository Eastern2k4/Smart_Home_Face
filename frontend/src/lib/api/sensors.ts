// lib/api/sensors.ts
import { SensorReading, GasSensorReading } from "@/lib/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sensorApi = {
  async getUltrasonic(): Promise<SensorReading> {
    await delay(300);
    return {
      distance: Math.floor(Math.random() * 400) + 5,
      unit: "cm",
      timestamp: new Date().toISOString(),
    };
  },

  async toggleLED(state: boolean): Promise<{ ledState: boolean }> {
    await delay(200);
    return { ledState: state };
  },

  async getGas(): Promise<GasSensorReading> {
    await delay(400);
    const ppm = Math.floor(Math.random() * 500) + 10;
    let level: GasSensorReading["level"] = "safe";
    if (ppm > 300) level = "alert";
    else if (ppm > 150) level = "warning";
    return { ppm, level, timestamp: new Date().toISOString() };
  },

  async triggerBuzzer(durationMs = 500): Promise<void> {
    await delay(durationMs);
  },

  async muteBuzzer(): Promise<void> {
    await delay(100);
  },
};
