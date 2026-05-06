// camera-tab.tsx
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader } from "lucide-react";

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

  // Attach stream to video element when stream is available
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error);
      });
    }
  }, [videoStream]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, [videoStream]);

  // Capture from camera
  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      console.error("Video not ready");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.jpg", {
              type: "image/jpeg",
            });
            onVerify(file);
          }
        },
        "image/jpeg",
        0.95,
      );
    }
  }, [onVerify]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
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
          </div>
          <div className="flex gap-2">
            <Button
              onClick={captureFromCamera}
              disabled={loading}
              className="flex-1 gap-2"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              Capture & Verify
            </Button>
            <Button onClick={stopCamera} variant="outline" className="flex-1">
              Stop
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
