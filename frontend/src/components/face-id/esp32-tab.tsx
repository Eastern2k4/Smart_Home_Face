// components/face-id/esp32-tab.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Loader, Camera } from "lucide-react";
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
  const [esp32Url, setEsp32Url] = useState("http://172.16.1.197/capture");
  const [streamActive, setStreamActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const streamIframeRef = useRef<HTMLIFrameElement>(null);

  // Derive stream URL from base URL (replace /capture with /stream)
  const getStreamUrl = () => {
    const base = esp32Url.replace(/\/capture.*/, "");
    return `${base}/stream`;
  };

  const startStream = () => {
    if (!esp32Url.trim()) {
      alert("Please enter a valid ESP32 camera address first.");
      return;
    }
    setStreamActive(true);
  };

  const stopStream = () => {
    setStreamActive(false);
  };

  const captureAndVerify = async () => {
    if (isCapturing || loading) return;
    if (!esp32Url.trim()) {
      alert("Please enter a valid ESP32 camera address.");
      return;
    }

    setIsCapturing(true);
    setLoading(true);

    try {
      const file = await faceApi.fetchESP32Snapshot(esp32Url);
      await onVerify(file);
    } catch (error) {
      console.error("Capture error:", error);
      // Error is already handled by parent (shows result)
    } finally {
      setIsCapturing(false);
      setLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // No stream resources to clean up besides the iframe (handled automatically)
    };
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect to your ESP32‑CAM module. The live stream will appear below. Use
        the button to capture the current frame and verify your face.
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
          Example: http://192.168.1.100/capture (will automatically use /stream
          for live view)
        </p>
      </div>

      {!streamActive ? (
        <Button onClick={startStream} className="w-full gap-2">
          <Cpu className="w-4 h-4" />
          Start Live Stream
        </Button>
      ) : (
        <>
          <div
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ minHeight: "300px" }}
          >
            <iframe
              ref={streamIframeRef}
              src={getStreamUrl()}
              className="w-full h-full min-h-[300px]"
              style={{ border: "none" }}
              allow="autoplay"
              sandbox="allow-same-origin allow-scripts"
              title="ESP32 Live Stream"
            />
            {(isCapturing || loading) && (
              <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                <Loader className="w-5 h-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Live stream active</span>
            </div>
            <Button onClick={stopStream} variant="outline" size="sm">
              Stop Stream
            </Button>
          </div>
          <Button
            onClick={captureAndVerify}
            disabled={isCapturing || loading}
            className="w-full gap-2"
          >
            {isCapturing || loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            Capture & Verify
          </Button>
        </>
      )}
    </div>
  );
};
