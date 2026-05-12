// lib/api/sensors.ts
const API_BASE =
  process.env.NEXT_PUBLIC_ESP32_SENSOR_URL || "http://172.16.5.233";
console.log("Using sensor API base URL:", API_BASE);

export const sensorApi = {
  async getAllSensors() {
    const res = await fetch(`${API_BASE}/api/sensors`);
    if (!res.ok) throw new Error("Failed to fetch sensors");
    return res.json();
  },

  async getDevices() {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error("Failed to fetch devices");
    return res.json();
  },

  async toggleLED(ledId: "wc" | "kitchen" | "bedroom", state: boolean) {
    const action = state ? "on" : "off";
    const aliases =
      ledId === "bedroom" ? ["bedroom", "bed", "room"] : [ledId];

    let lastError: unknown = null;
    for (const alias of aliases) {
      try {
        const res = await fetch(`${API_BASE}/api/light/${alias}/${action}`, {
          method: "GET",
        });
        if (res.ok) return res.json();
        lastError = new Error(`HTTP ${res.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error(`Failed to toggle ${ledId} light`);
  },

  async setDoor(open: boolean) {
    const action = open ? "open" : "close";
    const res = await fetch(`${API_BASE}/api/door/${action}`, {
      method: "GET",
    });
    if (!res.ok) throw new Error("Failed to control door");
    return res.json();
  },

  async getGas(): Promise<number> {
    const data = await this.getAllSensors();
    return data.gas ?? 0;
  },

  async getLEDStatuses(): Promise<Record<string, boolean>> {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error("Failed to get device states");
    const data = await res.json();
    // Map ESP32's keys to frontend expected keys (if needed)
    return {
      wc: data.wcLight ?? false,
      kitchen: data.kitchenLight ?? false,
      bedroom: data.bedroomLight ?? false,
    };
  },

  // Optional
  async triggerBuzzer(durationMs: number): Promise<void> {
    console.warn("Buzzer not implemented on ESP32 yet");
    // await fetch(`${API_BASE}/api/buzzer`, { method: "POST", body: JSON.stringify({ duration: durationMs }) });
  },

  async muteBuzzer(): Promise<void> {
    console.warn("Buzzer not implemented on ESP32 yet");
    // await fetch(`${API_BASE}/api/buzzer/mute`, { method: "POST" });
  },
};
