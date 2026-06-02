// lib/api/sensors.ts
function getApiBase() {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5001`;
  }

  return "http://localhost:5001";
}

export const sensorApi = {
  async getAllSensors() {
    const res = await fetch(`${getApiBase()}/api/sensors`);
    if (!res.ok) throw new Error("Failed to fetch sensors");
    return res.json();
  },

  async getDevices() {
    const res = await fetch(`${getApiBase()}/api/devices`);
    if (!res.ok) throw new Error("Failed to fetch devices");
    return res.json();
  },

  async toggleLED(ledId: "wc" | "kitchen" | "bedroom", state: boolean) {
    const action = state ? "on" : "off";
    const res = await fetch(
      `${getApiBase()}/api/control/light/${ledId}/${action}`,
      {
        method: "POST",
      },
    );
    if (!res.ok) throw new Error(`Failed to toggle ${ledId} light`);
    return res.json();
  },

  async setDoor(open: boolean) {
    const action = open ? "open" : "close";
    const res = await fetch(`${getApiBase()}/api/control/door/${action}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to control door");
    return res.json();
  },

  // Optional – not used directly by frontend
  async getGas(): Promise<number> {
    const data = await this.getAllSensors();
    return data.gas ?? 0;
  },

  async getLEDStatuses(): Promise<Record<string, boolean>> {
    const devices = await this.getDevices();
    return {
      wc: devices.wcLight ?? false,
      kitchen: devices.kitchenLight ?? false,
      bedroom: devices.bedroomLight ?? false,
    };
  },

  // Placeholder for buzzer – can be added later if needed
  async triggerBuzzer(durationMs: number): Promise<void> {
    console.warn("Buzzer not implemented");
  },
  async muteBuzzer(): Promise<void> {
    console.warn("Buzzer not implemented");
  },
};
