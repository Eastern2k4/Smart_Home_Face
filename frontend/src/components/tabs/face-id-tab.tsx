"use client";

import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  DoorClosed,
  DoorOpen,
  Loader,
  Upload,
  XCircle,
} from "lucide-react";

import { faceApi } from "@/lib/api/face";
import { sensorApi } from "@/lib/api/sensors";
import { useStore } from "@/lib/store";
import { CameraTab } from "@/components/face-id/camera-tab";
import { ESP32Tab } from "@/components/face-id/esp32-tab";
import { FaceDatabase } from "@/components/face-id/face-database";

export function FaceIdTab() {
  const store = useStore();
  const [verificationTab, setVerificationTab] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    verified: boolean;
    name?: string;
    confidence?: number;
    message: string;
  } | null>(null);
  const [doorActionLoading, setDoorActionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onVerificationSuccess = async (name: string) => {
    try {
      await sensorApi.setDoor(true);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 1,
        action: `Door opened by face recognition (${name})`,
      });
      const devices = await sensorApi.getDevices();
      store.setDoorState(devices.doorOpen);
    } catch (err) {
      console.error("Failed to open door:", err);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 0,
        action: `Failed to open door after face recognition (${name})`,
      });
    }
  };

  const handleVerificationResponse = async (
    response: Awaited<ReturnType<typeof faceApi.verify>>,
  ) => {
    setResult({
      verified: response.verified,
      name: response.name,
      confidence: response.confidence,
      message: response.message,
    });
    if (response.verified && response.name) {
      await onVerificationSuccess(response.name);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await faceApi.verify(file);
      await handleVerificationResponse(response);
    } catch (err) {
      setResult({ verified: false, message: "Verification error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCameraVerification = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const response = await faceApi.verify(file);
      await handleVerificationResponse(response);
    } catch (err) {
      setResult({ verified: false, message: "Verification error" });
    } finally {
      setLoading(false);
    }
  };

  const handleESP32Verification = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const response = await faceApi.verify(file);
      await handleVerificationResponse(response);
    } catch (err) {
      setResult({ verified: false, message: "Verification error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDoor = async () => {
    setDoorActionLoading(true);
    try {
      await sensorApi.setDoor(false);
      store.setDoorState(false);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 0,
        action: "Door manually closed",
      });
    } catch (err) {
      console.error("Failed to close door:", err);
      alert("Failed to close door");
    } finally {
      setDoorActionLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-xl">Face Verification</CardTitle>
          <CardDescription>
            Verify identity with upload, webcam, or ESP32 capture. The door opens automatically on success.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={verificationTab} onValueChange={setVerificationTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-lg bg-secondary p-1">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="camera">Camera</TabsTrigger>
              <TabsTrigger value="esp32">ESP32</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div
                className="mt-4 cursor-pointer rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-10 text-center transition-colors hover:border-primary hover:bg-primary/10"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto mb-3 size-10 text-primary" />
                <p className="text-sm font-medium text-foreground">Click to upload an image</p>
                <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or camera photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              <CameraTab onVerify={handleCameraVerification} loading={loading} setLoading={setLoading} />
            </TabsContent>

            <TabsContent value="esp32" className="space-y-4">
              <ESP32Tab onVerify={handleESP32Verification} loading={loading} setLoading={setLoading} />
            </TabsContent>
          </Tabs>

          {result && (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                result.verified
                  ? "border-primary/30 bg-primary/10"
                  : "border-destructive/30 bg-destructive/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.verified ? (
                  <CheckCircle2 className="mt-0.5 size-5 flex-shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 size-5 flex-shrink-0 text-destructive" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{result.message}</p>
                  {result.verified && result.name && result.confidence && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {result.name} matched with {result.confidence.toFixed(1)}% confidence
                      </p>
                      <Progress value={result.confidence} className="h-1.5" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <FaceDatabase />

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {store.doorOpen ? (
                <DoorOpen className="size-5 text-primary" />
              ) : (
                <DoorClosed className="size-5 text-muted-foreground" />
              )}
              Door Status
            </CardTitle>
            <CardDescription>
              {store.doorOpen ? "Door is currently open" : "Door is currently closed"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCloseDoor}
              disabled={!store.doorOpen || doorActionLoading}
              variant={store.doorOpen ? "destructive" : "outline"}
              className="w-full gap-2"
            >
              {doorActionLoading ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <DoorClosed className="size-4" />
              )}
              {store.doorOpen ? "Close Door" : "Door Closed"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Door opens automatically when a registered face is recognized.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
