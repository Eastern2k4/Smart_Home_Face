"use client";
import { create } from "zustand";

export interface SensorEvent {
  timestamp: string;
  type: "gas" | "led" | "distance" | "door" | "buzzer";
  value: number;
  action: string;
}

export interface LedState {
  wc: boolean;
  kitchen: boolean;
  bedroom: boolean;
}

export interface SensorData {
  livingRoom: { temperature: number; humidity: number };
  bedroom: { temperature: number; humidity: number };
  kitchen: { distance: number };
  wc: { distance: number };
  gas: number;
}

interface Store {
  // Data
  sensors: SensorData;
  doorOpen: boolean;
  leds: LedState;

  // Client preferences
  autoLed: { wc: boolean; kitchen: boolean; bedroom: boolean };
  ledThresholds: { wc: number; kitchen: number; bedroom: number };
  gasThreshold: number;
  gasAlertActive: boolean;
  buzzerMuteTime: number;
  pollingInterval: number;

  // Logs & stats
  events: SensorEvent[];
  stats: {
    wcDistances: number[];
    kitchenDistances: number[];
    gasReadings: number[];
  };

  // Pure setters (no API calls, no logic)
  setSensors: (data: SensorData) => void;
  setDoorState: (open: boolean) => void;
  setLedState: (led: keyof LedState, state: boolean) => void;
  setAutoLed: (led: keyof LedState, enabled: boolean) => void;
  setLedThreshold: (led: keyof LedState, threshold: number) => void;
  setGasThreshold: (threshold: number) => void;
  setBuzzerMuteTime: (time: number) => void;
  setPollingInterval: (interval: number) => void;
  addEvent: (event: SensorEvent) => void;
  clearEvents: () => void;
  addDistanceReading: (sensor: "wc" | "kitchen", value: number) => void;
  addGasReading: (value: number) => void;
  setGasAlertActive: (active: boolean) => void;
}

export const useStore = create<Store>((set, get) => ({
  sensors: {
    livingRoom: { temperature: 0, humidity: 0 },
    bedroom: { temperature: 0, humidity: 0 },
    kitchen: { distance: 0 },
    wc: { distance: 0 },
    gas: 0,
  },
  doorOpen: false,
  leds: { wc: false, kitchen: false, bedroom: false },
  autoLed: { wc: false, kitchen: false, bedroom: false },
  ledThresholds: { wc: 30, kitchen: 50, bedroom: 30 },
  gasThreshold: 500,
  gasAlertActive: false,
  buzzerMuteTime: 0,
  pollingInterval: 2.5,
  events: [],
  stats: { wcDistances: [], kitchenDistances: [], gasReadings: [] },

  // Pure setters
  setSensors: (data) => set({ sensors: data }),
  setDoorState: (open) => set({ doorOpen: open }),
  setLedState: (led, state) =>
    set((s) => ({ leds: { ...s.leds, [led]: state } })),
  setAutoLed: (led, enabled) =>
    set((s) => ({ autoLed: { ...s.autoLed, [led]: enabled } })),
  setLedThreshold: (led, threshold) =>
    set((s) => ({ ledThresholds: { ...s.ledThresholds, [led]: threshold } })),
  setGasThreshold: (threshold) => set({ gasThreshold: threshold }),
  setBuzzerMuteTime: (time) => set({ buzzerMuteTime: time }),
  setPollingInterval: (interval) => set({ pollingInterval: interval }),
  setGasAlertActive: (active) => set({ gasAlertActive: active }),
  addEvent: (event) =>
    set((s) => ({ events: [event, ...s.events].slice(0, 50) })),
  clearEvents: () => set({ events: [] }),
  addDistanceReading: (sensor, value) =>
    set((s) => ({
      stats: {
        ...s.stats,
        [sensor === "wc" ? "wcDistances" : "kitchenDistances"]: [
          ...s.stats[sensor === "wc" ? "wcDistances" : "kitchenDistances"],
          value,
        ].slice(-20),
      },
    })),
  addGasReading: (value) =>
    set((s) => ({
      stats: {
        ...s.stats,
        gasReadings: [...s.stats.gasReadings, value].slice(-20),
      },
    })),
}));
