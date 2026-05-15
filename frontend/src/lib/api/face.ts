// lib/api/face.ts
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export interface VerificationResult {
  verified: boolean;
  name?: string;
  confidence?: number;
  message: string;
}

export interface RecognitionStatus {
  running: boolean;
  door_allowed: boolean;
  classification: "idle" | "host" | "stranger" | "no_face";
  identity: string | null;
  confidence: number | null;
  image_path: string | null;
  stranger_duration_seconds: number;
  stranger_alert: boolean;
  event_id: number;
  event_type: "host" | "stranger_alert" | null;
  event_message: string | null;
  event_at: string | null;
  updated_at: string | null;
  error: string | null;
}

export const faceApi = {
  async verify(imageFile: File): Promise<VerificationResult> {
    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await fetch(`${API_BASE}/api/verify-face`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Verification failed");

    const data = await res.json();

    // DeepFace response: { match: boolean, best_match?: {...} }
    if (data.match && data.best_match) {
      const best = data.best_match;
      // Compute confidence from distance (assuming threshold ~0.6)
      // confidence = max(0, min(100, (1 - distance/threshold) * 100))
      const threshold = best.threshold || 0.6;
      let confidence = best.confidence;
      if (confidence === undefined && best.distance !== undefined) {
        confidence = Math.max(
          0,
          Math.min(100, ((threshold - best.distance) / threshold) * 100),
        );
      }
      return {
        verified: true,
        name: best.identity,
        confidence: confidence,
        message: `Welcome ${best.identity}!`,
      };
    } else {
      return {
        verified: false,
        message: data.best_match?.identity
          ? `Not a match (closest: ${data.best_match.identity})`
          : "Face not recognized",
      };
    }
  },

  // addFace, getFaces, deleteFace remain the same (they already match your backend)
  async addFace(
    name: string,
    imageFile: File,
  ): Promise<{ success: boolean; message?: string }> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("image", imageFile);
    const res = await fetch(`${API_BASE}/api/add-face`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Add face failed");
    return res.json();
  },

  async addHostFace(
    imageFile: File,
  ): Promise<{ success: boolean; message?: string; identity?: string }> {
    const formData = new FormData();
    formData.append("image", imageFile);
    const res = await fetch(`${API_BASE}/api/add-host-face`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Add host face failed");
    return res.json();
  },

  async getFaces(): Promise<{ faces: string[] }> {
    const res = await fetch(`${API_BASE}/api/get-faces`);
    if (!res.ok) throw new Error("Failed to load faces");
    return res.json();
  },

  async fetchESP32Snapshot(cameraUrl: string): Promise<File> {
    const res = await fetch(
      `${API_BASE}/api/esp32/snapshot?camera_url=${encodeURIComponent(cameraUrl)}`,
    );
    if (!res.ok) {
      let errorText = res.statusText;
      try {
        const data = await res.json();
        errorText = data.error || data.message || errorText;
      } catch {
        errorText = await res.text();
      }
      throw new Error(`Failed to fetch ESP32 snapshot: ${errorText}`);
    }
    const blob = await res.blob();
    return new File([blob], "esp32-capture.jpg", { type: "image/jpeg" });
  },

  async deleteFace(name: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/delete-face`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  },

  async getRecognitionStatus(): Promise<RecognitionStatus> {
    const res = await fetch(`${API_BASE}/api/camera/recognition-status`);
    if (!res.ok) throw new Error("Failed to load recognition status");
    return res.json();
  },

  async startRecognition(): Promise<{ success: boolean; started: boolean }> {
    const res = await fetch(`${API_BASE}/api/camera/recognition/start`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to start recognition");
    return res.json();
  },

  async stopRecognition(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/camera/recognition/stop`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to stop recognition");
    return res.json();
  },
};
