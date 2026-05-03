// lib/store/sensorSlice.ts
import { StateCreator } from "zustand";
import { SensorEvent } from "@/lib/types";

export interface SensorSlice {
  distance: number;
  gas: number;
  ledStatus: boolean;
  buzzerStatus: boolean;
  ledAutoMode: boolean;
  ledThreshold: number;
  gasThreshold: number;
  autoBuzzer: boolean;
  buzzerMuteTime: number;
  pollingInterval: number;
  events: SensorEvent[];
  distanceReadings: number[];
  gasReadings: number[];
  setDistance: (val: number) => void;
  setGas: (val: number) => void;
  setLedStatus: (val: boolean) => void;
  setBuzzerStatus: (val: boolean) => void;
  setLedAutoMode: (val: boolean) => void;
  setLedThreshold: (val: number) => void;
  setGasThreshold: (val: number) => void;
  setAutoBuzzer: (val: boolean) => void;
  setBuzzerMuteTime: (val: number) => void;
  setPollingInterval: (val: number) => void;
  addEvent: (event: SensorEvent) => void;
  clearEvents: () => void;
  addDistanceReading: (val: number) => void;
  addGasReading: (val: number) => void;
  clearReadings: () => void;
}

export const createSensorSlice: StateCreator<SensorSlice> = (set) => ({
  distance: 0,
  gas: 0,
  ledStatus: false,
  buzzerStatus: false,
  ledAutoMode: false,
  ledThreshold: 50,
  gasThreshold: 200,
  autoBuzzer: true,
  buzzerMuteTime: 0,
  pollingInterval: 2.5,
  events: [],
  distanceReadings: [],
  gasReadings: [],

  setDistance: (val) => set({ distance: val }),
  setGas: (val) => set({ gas: val }),
  setLedStatus: (val) => set({ ledStatus: val }),
  setBuzzerStatus: (val) => set({ buzzerStatus: val }),
  setLedAutoMode: (val) => set({ ledAutoMode: val }),
  setLedThreshold: (val) => set({ ledThreshold: val }),
  setGasThreshold: (val) => set({ gasThreshold: val }),
  setAutoBuzzer: (val) => set({ autoBuzzer: val }),
  setBuzzerMuteTime: (val) => set({ buzzerMuteTime: val }),
  setPollingInterval: (val) => set({ pollingInterval: val }),

  addEvent: (event) =>
    set((state) => ({
      events:
        state.events.length >= 50
          ? [...state.events.slice(1), event]
          : [...state.events, event],
    })),
  clearEvents: () => set({ events: [] }),

  addDistanceReading: (val) =>
    set((state) => ({
      distanceReadings:
        state.distanceReadings.length >= 20
          ? [...state.distanceReadings.slice(1), val]
          : [...state.distanceReadings, val],
    })),
  addGasReading: (val) =>
    set((state) => ({
      gasReadings:
        state.gasReadings.length >= 20
          ? [...state.gasReadings.slice(1), val]
          : [...state.gasReadings, val],
    })),
  clearReadings: () => set({ distanceReadings: [], gasReadings: [] }),
});
