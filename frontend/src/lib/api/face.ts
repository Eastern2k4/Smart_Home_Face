// lib/api/face.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export interface VerificationResult {
  verified: boolean;
  name?: string;
  confidence?: number;
  message: string;
}

export const faceApi = {
  async verify(imageFile: File): Promise<VerificationResult> {
    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await fetch(`${API_BASE}/verify-face`, {
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
    const res = await fetch(`${API_BASE}/add-face`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Add face failed");
    return res.json();
  },

  async getFaces(): Promise<{ faces: string[] }> {
    const res = await fetch(`${API_BASE}/get-faces`);
    if (!res.ok) throw new Error("Failed to load faces");
    return res.json();
  },

  async deleteFace(name: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/delete-face`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  },
};
