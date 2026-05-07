// Sensor-related types
export interface SensorReading {
  distance: number;
  unit: string;
  timestamp: string;
}

export interface GasSensorReading {
  ppm: number;
  level: "safe" | "warning" | "alert";
  timestamp: string;
}

export interface SensorEvent {
  timestamp: string;
  type: "gas" | "led" | "buzzer" | "distance";
  value: number;
  action: string;
}

// Face-related types
export interface FaceInDatabase {
  id: string;
  name: string;
  addedDate: string;
}

export interface VerificationResult {
  verified: boolean;
  name?: string;
  confidence?: number;
  message: string;
}

// Store state types
export interface SensorState {
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
}
