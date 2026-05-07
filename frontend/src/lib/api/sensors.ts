// lib/api/sensors.ts
const API_BASE =
  process.env.NEXT_PUBLIC_SENSOR_API_URL || "http://localhost:5001";

export const sensorApi = {
  // Ultrasonic sensors
  async getToiletDistance(): Promise<number> {
    const res = await fetch(`${API_BASE}/api/toilet_ultrasonic`);
    const data = await res.json();
    return data.distance;
  },

  async getKitchenDistance(): Promise<number> {
    const res = await fetch(`${API_BASE}/api/kitchen_ultrasonic`);
    const data = await res.json();
    return data.distance;
  },

  // Gas sensor
  async getGas(): Promise<number> {
    const res = await fetch(`${API_BASE}/api/gas`);
    const data = await res.json();
    return data.ppm;
  },

  // LED control
  async toggleLED(ledId: string, state: boolean): Promise<void> {
    await fetch(`${API_BASE}/api/led/${ledId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: state ? 1 : 0 }),
    });
  },

  async getLEDStatuses(): Promise<Record<string, boolean>> {
    const res = await fetch(`${API_BASE}/api/leds`);
    return res.json();
  },

  // Buzzer control
  async triggerBuzzer(durationMs: number): Promise<void> {
    await fetch(`${API_BASE}/api/buzzer`, {
      method: "POST",
      body: JSON.stringify({ duration: durationMs }),
    });
  },

  async muteBuzzer(): Promise<void> {
    await fetch(`${API_BASE}/api/buzzer/mute`, { method: "POST" });
  },
};
