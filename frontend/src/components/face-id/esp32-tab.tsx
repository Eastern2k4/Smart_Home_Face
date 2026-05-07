// components/face-id/esp32-tab.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Loader, XCircle } from "lucide-react";
import { faceApi } from "@/lib/api/face";

interface ESP32TabProps {
  onVerify: (file: File) => Promise<void>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const ESP32Tab: React.FC<ESP32TabProps> = ({
  onVerify,
  loading,
  setLoading,
}) => {
  const [esp32Url, setEsp32Url] = useState("http://172.16.2.105/capture");
  const [esp32Preview, setEsp32Preview] = useState<string | null>(null);
  const [esp32Fetching, setEsp32Fetching] = useState(false);

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      if (esp32Preview) {
        URL.revokeObjectURL(esp32Preview);
      }
    };
  }, [esp32Preview]);

  // Fetch snapshot from ESP32
  const fetchEsp32Snapshot = async () => {
    if (!esp32Url.trim()) {
      alert(
        "Please enter the ESP32 camera address. Example: http://192.168.1.100/capture",
      );
      return;
    }

    setEsp32Fetching(true);
    setEsp32Preview(null);

    try {
      const file = await faceApi.fetchESP32Snapshot(esp32Url);
      const objectUrl = URL.createObjectURL(file);
      setEsp32Preview(objectUrl);
      await onVerify(file);
    } catch (error) {
      console.error("ESP32 snapshot error:", error);
      // The parent component will handle displaying the error result
      if (error instanceof Error) {
        throw error;
      }
    } finally {
      setEsp32Fetching(false);
    }
  };

  const clearPreview = () => {
    if (esp32Preview) {
      URL.revokeObjectURL(esp32Preview);
      setEsp32Preview(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Verify using the ESP32 camera module connected to your system.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium">ESP32 Camera Address</label>
        <Input
          type="text"
          placeholder="http://192.168.1.100/capture"
          value={esp32Url}
          onChange={(e) => setEsp32Url(e.target.value)}
          className="glass-sm"
        />
        <p className="text-xs text-muted-foreground">
          Example: http://192.168.1.100/capture
        </p>
      </div>

      <Button
        onClick={fetchEsp32Snapshot}
        disabled={esp32Fetching || !esp32Url.trim()}
        className="w-full gap-2"
      >
        {esp32Fetching ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <Cpu className="w-4 h-4" />
        )}
        {esp32Fetching ? "Fetching..." : "Fetch ESP32 Snapshot"}
      </Button>

      {esp32Preview && (
        <div className="mt-4 space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-border bg-black/20">
            <img
              src={esp32Preview}
              alt="ESP32 Snapshot"
              className="w-full h-auto object-contain"
            />
            <Button
              onClick={clearPreview}
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
            >
              Clear
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Captured from ESP32 camera - this image will be used for
            verification
          </p>
        </div>
      )}
    </div>
  );
};
