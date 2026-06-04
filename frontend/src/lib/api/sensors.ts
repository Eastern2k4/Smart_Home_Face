// lib/api/sensors.ts
function getApiBase() {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return "http://localhost:8000";
}

export type SpeakerTarget = "front_door" | "house_gas";

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

  async triggerBuzzer(durationMs: number): Promise<void> {
    const res = await fetch(`${getApiBase()}/api/speaker/alert/front_door`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to trigger speaker alert");
  },
  async muteBuzzer(): Promise<void> {
    console.warn("Buzzer not implemented");
  },

  async getSpeakerSettings() {
    const res = await fetch(`${getApiBase()}/api/speaker/settings`);
    if (!res.ok) throw new Error("Failed to load speaker settings");
    return res.json();
  },

  async updateSpeakerAudio(settings: {
    frontVolume: number;
    houseGasVolume: number;
    frontFrequency: number;
    houseGasFrequency: number;
    duration: number;
  }) {
    const res = await fetch(`${getApiBase()}/api/speaker/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error("Failed to update speaker audio");
    return res.json();
  },

  async testSpeaker(target: SpeakerTarget) {
    const res = await fetch(`${getApiBase()}/api/speaker/test/${target}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to test speaker");
    return res.json();
  },
};
