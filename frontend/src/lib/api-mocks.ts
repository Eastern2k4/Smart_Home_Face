// Mock API for IoT devices - simulates realistic delays and responses

export interface FaceData {
  id: string;
  name: string;
  confidence: number;
  timestamp: string;
}

export interface VerificationResult {
  verified: boolean;
  name?: string;
  confidence?: number;
  timestamp: string;
  message: string;
}

export interface FaceInDatabase {
  id: string;
  name: string;
  addedDate: string;
}

export interface SensorReading {
  distance: number;
  unit: string;
  timestamp: string;
}

export interface GasSensorReading {
  ppm: number;
  level: 'safe' | 'warning' | 'alert';
  timestamp: string;
}

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock face database
let faceDatabase: FaceInDatabase[] = [
  { id: '1', name: 'John Doe', addedDate: '2024-01-15' },
  { id: '2', name: 'Jane Smith', addedDate: '2024-02-03' },
  { id: '3', name: 'Alex Johnson', addedDate: '2024-02-10' },
];

let nextFaceId = 4;

// Face Recognition APIs
export async function verifyFaceFromImage(imageData: string): Promise<VerificationResult> {
  await delay(1500); // Simulate processing time
  
  // Random verification for demo
  const isVerified = Math.random() > 0.3;
  const names = ['John Doe', 'Jane Smith', 'Alex Johnson'];
  const randomName = names[Math.floor(Math.random() * names.length)];
  
  return {
    verified: isVerified,
    name: isVerified ? randomName : undefined,
    confidence: isVerified ? 85 + Math.random() * 15 : undefined,
    timestamp: new Date().toISOString(),
    message: isVerified ? `Welcome back, ${randomName}!` : 'Face not recognized. Access denied.',
  };
}

export async function verifyFaceFromCamera(): Promise<VerificationResult> {
  await delay(2000); // Simulate camera processing
  
  const isVerified = Math.random() > 0.25;
  const names = ['John Doe', 'Jane Smith', 'Alex Johnson'];
  const randomName = names[Math.floor(Math.random() * names.length)];
  
  return {
    verified: isVerified,
    name: isVerified ? randomName : undefined,
    confidence: isVerified ? 82 + Math.random() * 18 : undefined,
    timestamp: new Date().toISOString(),
    message: isVerified ? `Welcome back, ${randomName}!` : 'Face not recognized. Access denied.',
  };
}

export async function verifyFaceFromESP32(): Promise<VerificationResult> {
  await delay(2500); // ESP32 is slower
  
  const isVerified = Math.random() > 0.35;
  const names = ['John Doe', 'Jane Smith', 'Alex Johnson'];
  const randomName = names[Math.floor(Math.random() * names.length)];
  
  return {
    verified: isVerified,
    name: isVerified ? randomName : undefined,
    confidence: isVerified ? 78 + Math.random() * 22 : undefined,
    timestamp: new Date().toISOString(),
    message: isVerified ? `Welcome back, ${randomName}!` : 'Face not recognized. Access denied.',
  };
}

// Face Database APIs
export async function getFaceDatabase(): Promise<FaceInDatabase[]> {
  await delay(500);
  return [...faceDatabase];
}

export async function addFaceToDatabase(name: string): Promise<FaceInDatabase> {
  await delay(800);
  
  const newFace: FaceInDatabase = {
    id: String(nextFaceId++),
    name,
    addedDate: new Date().toISOString().split('T')[0],
  };
  
  faceDatabase.push(newFace);
  return newFace;
}

export async function removeFaceFromDatabase(id: string): Promise<boolean> {
  await delay(600);
  
  const index = faceDatabase.findIndex(f => f.id === id);
  if (index > -1) {
    faceDatabase.splice(index, 1);
    return true;
  }
  
  return false;
}

// Ultrasonic Sensor APIs
export async function getUltrasonicReading(): Promise<SensorReading> {
  await delay(300);
  
  return {
    distance: Math.floor(Math.random() * 400) + 5, // 5-405 cm
    unit: 'cm',
    timestamp: new Date().toISOString(),
  };
}

export async function toggleLED(state: boolean): Promise<{ status: string; ledState: boolean }> {
  await delay(200);
  
  return {
    status: 'success',
    ledState: state,
  };
}

// Gas Sensor APIs
export async function getGasSensorReading(): Promise<GasSensorReading> {
  await delay(400);
  
  const ppm = Math.floor(Math.random() * 500) + 10;
  let level: 'safe' | 'warning' | 'alert' = 'safe';
  
  if (ppm > 300) level = 'alert';
  else if (ppm > 150) level = 'warning';
  
  return {
    ppm,
    level,
    timestamp: new Date().toISOString(),
  };
}

export async function triggerBuzzer(durationMs: number): Promise<{ status: string; duration: number }> {
  await delay(durationMs + 100);
  
  return {
    status: 'success',
    duration: durationMs,
  };
}

export async function muteBuzzer(): Promise<{ status: string }> {
  await delay(100);
  
  return {
    status: 'success',
  };
}
