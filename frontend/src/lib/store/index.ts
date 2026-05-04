// lib/store/index.ts
import { create } from "zustand";
import { createSensorSlice, SensorSlice } from "./sensorSlice";

export const useStore = create<SensorSlice>()((...a) => ({
  ...createSensorSlice(...a),
}));
