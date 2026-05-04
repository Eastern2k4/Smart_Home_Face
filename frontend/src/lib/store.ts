'use client';

import { create } from 'zustand';

export interface SensorEvent {
  timestamp: string;
  type: 'gas' | 'led' | 'buzzer' | 'distance';
  value: number;
  action: string;
}

export interface SensorData {
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
}

interface Store extends SensorData {
  // Setters
  setDistance: (distance: number) => void;
  setGas: (gas: number) => void;
  setLedStatus: (status: boolean) => void;
  setBuzzerStatus: (status: boolean) => void;
  setLedAutoMode: (mode: boolean) => void;
  setLedThreshold: (threshold: number) => void;
  setGasThreshold: (threshold: number) => void;
  setAutoBuzzer: (auto: boolean) => void;
  setBuzzerMuteTime: (time: number) => void;
  setPollingInterval: (interval: number) => void;

  // Event log
  events: SensorEvent[];
  addEvent: (event: SensorEvent) => void;
  clearEvents: () => void;

  // Statistics
  distanceReadings: number[];
  gasReadings: number[];
  addDistanceReading: (value: number) => void;
  addGasReading: (value: number) => void;
  clearReadings: () => void;
}

export const useStore = create<Store>((set) => ({
  // Initial sensor data
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

  // Setters
  setDistance: (distance) => set({ distance }),
  setGas: (gas) => set({ gas }),
  setLedStatus: (status) => set({ ledStatus: status }),
  setBuzzerStatus: (status) => set({ buzzerStatus: status }),
  setLedAutoMode: (mode) => set({ ledAutoMode: mode }),
  setLedThreshold: (threshold) => set({ ledThreshold: threshold }),
  setGasThreshold: (threshold) => set({ gasThreshold: threshold }),
  setAutoBuzzer: (auto) => set({ autoBuzzer: auto }),
  setBuzzerMuteTime: (time) => set({ buzzerMuteTime: time }),
  setPollingInterval: (interval) => set({ pollingInterval: interval }),

  // Event log (max 50 entries)
  events: [],
  addEvent: (event) =>
    set((state) => ({
      events:
        state.events.length >= 50
          ? [...state.events.slice(1), event]
          : [...state.events, event],
    })),
  clearEvents: () => set({ events: [] }),

  // Chart data (keep last 20 readings)
  distanceReadings: [],
  gasReadings: [],
  addDistanceReading: (value) =>
    set((state) => ({
      distanceReadings:
        state.distanceReadings.length >= 20
          ? [...state.distanceReadings.slice(1), value]
          : [...state.distanceReadings, value],
    })),
  addGasReading: (value) =>
    set((state) => ({
      gasReadings:
        state.gasReadings.length >= 20
          ? [...state.gasReadings.slice(1), value]
          : [...state.gasReadings, value],
    })),
  clearReadings: () => set({ distanceReadings: [], gasReadings: [] }),
}));
