"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  CheckCircle2,
  XCircle,
  DoorOpen,
  DoorClosed,
  Loader,
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

  // After successful verification, open door
  const onVerificationSuccess = async (name: string) => {
    try {
      await sensorApi.setDoor(true);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 1,
        action: `Door opened by face recognition (${name})`,
      });
      // Refresh door state (polling will also update eventually)
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

  // Upload image verification
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Face Verification */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Face Verification</CardTitle>
          <CardDescription>
            Verify identity using face recognition – door will open
            automatically on success
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={verificationTab}
            onValueChange={setVerificationTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="camera">Camera</TabsTrigger>
              <TabsTrigger value="esp32">ESP32</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload an image
                </p>
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
              <CameraTab
                onVerify={handleCameraVerification}
                loading={loading}
                setLoading={setLoading}
              />
            </TabsContent>

            <TabsContent value="esp32" className="space-y-4">
              <ESP32Tab
                onVerify={handleESP32Verification}
                loading={loading}
                setLoading={setLoading}
              />
            </TabsContent>
          </Tabs>

          {result && (
            <div
              className={`mt-4 p-4 rounded-lg border ${
                result.verified
                  ? "bg-accent/10 border-accent"
                  : "bg-destructive/10 border-destructive"
              }`}
            >
              <div className="flex gap-3 items-start">
                {result.verified ? (
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-sm">{result.message}</p>
                  {result.verified && result.name && result.confidence && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Confidence: {result.confidence?.toFixed(1)}%
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

      {/* Right Column - Face Database + Door Control */}
      <div className="space-y-6">
        <FaceDatabase />

        {/* Door Control Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {store.doorOpen ? (
                <DoorOpen className="w-5 h-5 text-green-500" />
              ) : (
                <DoorClosed className="w-5 h-5 text-muted-foreground" />
              )}
              Door Status
            </CardTitle>
            <CardDescription>
              {store.doorOpen
                ? "Door is currently OPEN"
                : "Door is currently CLOSED"}
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
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <DoorClosed className="w-4 h-4" />
              )}
              {store.doorOpen ? "Close Door" : "Door Closed"}
            </Button>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Door opens automatically when a registered face is recognized.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
