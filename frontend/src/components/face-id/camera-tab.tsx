// camera-tab.tsx
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Camera, Loader, ScanEye } from "lucide-react";

interface CameraTabProps {
  onVerify: (file: File) => Promise<void>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const CameraTab: React.FC<CameraTabProps> = ({
  onVerify,
  loading,
  setLoading,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [autoVerify, setAutoVerify] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVerifyingRef = useRef(false);

  // Start camera
  const startCamera = useCallback(async () => {
    if (cameraActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setVideoStream(stream);
      setCameraActive(true);
    } catch (error) {
      console.error("Camera error:", error);
      alert("Camera access denied: " + (error as Error).message);
    }
  }, [cameraActive]);

  // Stop camera and clear interval
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, [videoStream]);

  // Capture a single frame and send to onVerify
  const captureAndVerify = useCallback(async () => {
    if (isVerifyingRef.current) return; // prevent overlapping requests
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    isVerifyingRef.current = true;
    setLoading(true);
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const file = new File([blob], "camera-capture.jpg", {
            type: "image/jpeg",
          });
          try {
            await onVerify(file);
          } finally {
            setLoading(false);
            isVerifyingRef.current = false;
          }
        } else {
          setLoading(false);
          isVerifyingRef.current = false;
        }
      },
      "image/jpeg",
      0.85, // slightly lower quality for faster upload
    );
  }, [onVerify, setLoading]);

  // Set up interval when camera is active and autoVerify is true
  useEffect(() => {
    if (cameraActive && autoVerify) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        captureAndVerify();
      }, 2000); // verify every 2 seconds
    } else if (!autoVerify && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cameraActive, autoVerify, captureAndVerify]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error);
      });
    }
  }, [videoStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoStream]);

  return (
    <div className="space-y-4">
      {!cameraActive ? (
        <Button onClick={startCamera} className="w-full gap-2">
          <Camera className="w-4 h-4" />
          Start Camera
        </Button>
      ) : (
        <>
          <div
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ minHeight: "300px" }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
            {loading && (
              <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                <Loader className="w-5 h-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanEye className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="auto-verify" className="text-sm">
                Auto verify (every 2s)
              </Label>
              <Switch
                id="auto-verify"
                checked={autoVerify}
                onCheckedChange={setAutoVerify}
              />
            </div>
            <Button onClick={stopCamera} variant="outline" size="sm">
              Stop Camera
            </Button>
          </div>
          {!autoVerify && (
            <Button
              onClick={captureAndVerify}
              disabled={loading}
              className="w-full gap-2"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              Verify Now
            </Button>
          )}
        </>
      )}
    </div>
  );
};
