// lib/store.ts
"use client";

import { create } from "zustand";

export interface SensorEvent {
  timestamp: string;
  type: "gas" | "led" | "buzzer" | "distance";
  value: number;
  action: string;
}

export interface LedConfig {
  id: string;
  name: string;
  status: boolean;
  autoMode: boolean;
  threshold: number;
  ultrasonicId: string | null; // 'toilet' | 'kitchen' | null (null = manual only)
}

export interface SensorData {
  // Ultrasonic sensors
  toiletDistance: number;
  kitchenDistance: number;

  // LEDs
  leds: LedConfig[];

  // Gas sensor
  gas: number;
  buzzerStatus: boolean;
  autoBuzzer: boolean;
  gasThreshold: number;
  buzzerMuteTime: number;
  pollingInterval: number;
}

interface Store extends SensorData {
  // Setters for ultrasonic sensors
  setToiletDistance: (distance: number) => void;
  setKitchenDistance: (distance: number) => void;

  // Setters for LEDs
  setLedStatus: (ledId: string, status: boolean) => void;
  setLedAutoMode: (ledId: string, mode: boolean) => void;
  setLedThreshold: (ledId: string, threshold: number) => void;

  // Setters for gas and buzzer
  setGas: (gas: number) => void;
  setBuzzerStatus: (status: boolean) => void;
  setAutoBuzzer: (auto: boolean) => void;
  setGasThreshold: (threshold: number) => void;
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

export const useStore = create<Store>((set, get) => ({
  // Initial sensor data
  toiletDistance: 0,
  kitchenDistance: 0,

  gas: 0,
  buzzerStatus: false,
  autoBuzzer: true,
  gasThreshold: 200,
  buzzerMuteTime: 0,
  pollingInterval: 2.5,

  // 3 LEDs configuration
  leds: [
    {
      id: "toiletLed",
      name: "Toilet LED",
      status: false,
      autoMode: false,
      threshold: 30,
      ultrasonicId: "toilet", // Controlled by toilet sensor
    },
    {
      id: "kitchenLed",
      name: "Kitchen LED",
      status: false,
      autoMode: false,
      threshold: 50,
      ultrasonicId: "kitchen", // Controlled by kitchen sensor
    },
    {
      id: "manualLed",
      name: "Manual LED",
      status: false,
      autoMode: false, // Always false - manual only
      threshold: 0,
      ultrasonicId: null, // No sensor control - manual only
    },
  ],

  // Setters for ultrasonic sensors
  setToiletDistance: (distance) => {
    set({ toiletDistance: distance });
    get().addDistanceReading(distance);

    // Check auto mode for LEDs controlled by toilet sensor
    const { leds } = get();
    leds.forEach((led) => {
      if (led.autoMode && led.ultrasonicId === "toilet") {
        const shouldBeOn = distance < led.threshold;
        if (shouldBeOn !== led.status) {
          // Update LED status in store
          set({
            leds: leds.map((l) =>
              l.id === led.id ? { ...l, status: shouldBeOn } : l,
            ),
          });

          // Add event
          get().addEvent({
            timestamp: new Date().toISOString(),
            type: "led",
            value: shouldBeOn ? 1 : 0,
            action: `${led.name} automatically turned ${shouldBeOn ? "ON" : "OFF"} (Toilet distance: ${distance}cm < ${led.threshold}cm)`,
          });
        }
      }
    });
  },

  setKitchenDistance: (distance) => {
    set({ kitchenDistance: distance });
    get().addDistanceReading(distance);

    // Check auto mode for LEDs controlled by kitchen sensor
    const { leds } = get();
    leds.forEach((led) => {
      if (led.autoMode && led.ultrasonicId === "kitchen") {
        const shouldBeOn = distance < led.threshold;
        if (shouldBeOn !== led.status) {
          // Update LED status in store
          set({
            leds: leds.map((l) =>
              l.id === led.id ? { ...l, status: shouldBeOn } : l,
            ),
          });

          // Add event
          get().addEvent({
            timestamp: new Date().toISOString(),
            type: "led",
            value: shouldBeOn ? 1 : 0,
            action: `${led.name} automatically turned ${shouldBeOn ? "ON" : "OFF"} (Kitchen distance: ${distance}cm < ${led.threshold}cm)`,
          });
        }
      }
    });
  },

  // Setters for LEDs
  setLedStatus: (ledId, status) => {
    set((state) => ({
      leds: state.leds.map((led) =>
        led.id === ledId ? { ...led, status } : led,
      ),
    }));
  },

  setLedAutoMode: (ledId, mode) => {
    // Manual LED cannot have auto mode
    if (ledId === "manualLed") return;

    set((state) => ({
      leds: state.leds.map((led) =>
        led.id === ledId ? { ...led, autoMode: mode } : led,
      ),
    }));

    // When enabling auto mode, immediately check current distance
    if (mode) {
      const { leds, toiletDistance, kitchenDistance } = get();
      const led = leds.find((l) => l.id === ledId);
      if (led && led.ultrasonicId) {
        const currentDistance =
          led.ultrasonicId === "toilet" ? toiletDistance : kitchenDistance;
        const shouldBeOn = currentDistance < led.threshold;
        if (shouldBeOn !== led.status) {
          get().setLedStatus(ledId, shouldBeOn);
          get().addEvent({
            timestamp: new Date().toISOString(),
            type: "led",
            value: shouldBeOn ? 1 : 0,
            action: `${led.name} auto mode enabled - turned ${shouldBeOn ? "ON" : "OFF"}`,
          });
        }
      }
    }
  },

  setLedThreshold: (ledId, threshold) => {
    set((state) => ({
      leds: state.leds.map((led) =>
        led.id === ledId ? { ...led, threshold } : led,
      ),
    }));

    // Check if threshold change affects current LED state
    const { leds, toiletDistance, kitchenDistance } = get();
    const led = leds.find((l) => l.id === ledId);
    if (led && led.autoMode && led.ultrasonicId) {
      const currentDistance =
        led.ultrasonicId === "toilet" ? toiletDistance : kitchenDistance;
      const shouldBeOn = currentDistance < threshold;
      if (shouldBeOn !== led.status) {
        get().setLedStatus(ledId, shouldBeOn);
        get().addEvent({
          timestamp: new Date().toISOString(),
          type: "led",
          value: shouldBeOn ? 1 : 0,
          action: `${led.name} threshold changed - turned ${shouldBeOn ? "ON" : "OFF"}`,
        });
      }
    }
  },

  // Setters for gas and buzzer
  setGas: (gas) => {
    set({ gas });
    get().addGasReading(gas);

    // Auto buzzer logic
    const { autoBuzzer, gasThreshold, buzzerStatus, buzzerMuteTime } = get();
    if (autoBuzzer && buzzerMuteTime === 0) {
      const shouldBuzz = gas > gasThreshold;
      if (shouldBuzz !== buzzerStatus) {
        set({ buzzerStatus: shouldBuzz });
        get().addEvent({
          timestamp: new Date().toISOString(),
          type: "buzzer",
          value: gas,
          action: `Buzzer automatically turned ${shouldBuzz ? "ON" : "OFF"} (gas: ${gas}ppm ${shouldBuzz ? ">" : "<"} ${gasThreshold}ppm)`,
        });
      }
    }
  },

  setBuzzerStatus: (status) => set({ buzzerStatus: status }),
  setAutoBuzzer: (auto) => set({ autoBuzzer: auto }),
  setGasThreshold: (threshold) => set({ gasThreshold: threshold }),
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
