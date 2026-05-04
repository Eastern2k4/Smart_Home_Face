'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Camera, Cpu, CheckCircle2, XCircle, Loader } from 'lucide-react';
import { verifyFaceFromImage, verifyFaceFromCamera, verifyFaceFromESP32 } from '@/lib/api-mocks';

export function FaceVerificationBlock() {
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    verified: boolean;
    name?: string;
    confidence?: number;
    message: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target?.result as string;
        const response = await verifyFaceFromImage(imageData);
        setResult(response);
      };
      reader.readAsDataURL(file);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setResult({
        verified: false,
        message: 'Camera access denied. Please enable camera permissions.',
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current) return;

    setLoading(true);
    setResult(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        const response = await verifyFaceFromCamera();
        setResult(response);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyViaESP32 = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await verifyFaceFromESP32();
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Face Verification</CardTitle>
        <CardDescription>Verify identity using face recognition</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
              <p className="text-sm text-muted-foreground">Click to upload an image</p>
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
            {!cameraActive ? (
              <Button onClick={startCamera} className="w-full gap-2">
                <Camera className="w-4 h-4" />
                Start Camera
              </Button>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <div className="flex gap-2">
                  <Button onClick={captureAndVerify} disabled={loading} className="flex-1 gap-2">
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Capture & Verify
                  </Button>
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    Stop
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="esp32" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Verify using the ESP32 camera module connected to your system.
            </p>
            <Button onClick={verifyViaESP32} disabled={loading} className="w-full gap-2">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              Verify via ESP32
            </Button>
          </TabsContent>
        </Tabs>

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result.verified ? 'bg-accent/10 border border-accent' : 'bg-destructive/10 border border-destructive'}`}>
            <div className="flex gap-3 items-start">
              {result.verified ? (
                <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-sm">{result.message}</p>
                {result.verified && result.name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Confidence: {result.confidence?.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
