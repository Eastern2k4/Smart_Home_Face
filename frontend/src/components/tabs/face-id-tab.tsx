"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Camera,
  Cpu,
  CheckCircle2,
  XCircle,
  Loader,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { faceApi } from "@/lib/api/face";

// Local type for the face database list (matches what we get from faceApi.getFaces)
interface FaceInDatabase {
  id: string;
  name: string;
  addedDate: string;
}

export function FaceIdTab() {
  // Verification state
  const [verificationTab, setVerificationTab] = useState("upload");
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

  // Database state
  const [faces, setFaces] = useState<FaceInDatabase[]>([]);
  const [newFaceName, setNewFaceName] = useState("");
  const [loadingDatabase, setLoadingDatabase] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add face image picker
  const addFaceFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAddFile, setSelectedAddFile] = useState<File | null>(null);

  // Load face list on mount
  useEffect(() => {
    loadFaces();
  }, []);

  // Load faces from backend
  const loadFaces = async () => {
    setLoadingDatabase(true);
    try {
      const { faces: names } = await faceApi.getFaces();
      const facesData = names.map((name, idx) => ({
        id: String(idx + 1),
        name,
        addedDate: new Date().toISOString().split("T")[0],
      }));
      setFaces(facesData);
    } catch (err) {
      console.error("Failed to load faces:", err);
    } finally {
      setLoadingDatabase(false);
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
      setResult({
        verified: response.verified,
        name: response.name,
        confidence: response.confidence,
        message: response.message,
      });
    } catch (err) {
      setResult({ verified: false, message: "Verification error" });
    } finally {
      setLoading(false);
    }
  };

  // Camera controls

  const startCamera = async () => {
    if (cameraActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        // Wait for video metadata to load before setting active
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn("Play error:", e));
          setCameraActive(true);
        };
      }
    } catch (error) {
      console.error("Camera error:", error);
      setResult({
        verified: false,
        message: "Camera access denied or not available.",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
    }
    setCameraActive(false);
  };

  const captureAndVerify = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setResult(null);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      try {
        const response = await faceApi.verify(file);
        setResult({
          verified: response.verified,
          name: response.name,
          confidence: response.confidence,
          message: response.message,
        });
      } catch (err) {
        setResult({ verified: false, message: "Verification error" });
      } finally {
        setLoading(false);
      }
    }, "image/jpeg");
  };

  const verifyViaESP32 = async () => {
    alert("ESP32 integration: fetch snapshot and call faceApi.verify(file)");
  };

  // Add a new face
  const handleAddFace = async () => {
    if (!newFaceName.trim()) {
      alert("Please enter a name");
      return;
    }
    if (!selectedAddFile) {
      alert("Please select an image for the face");
      return;
    }

    setLoadingDatabase(true);
    try {
      await faceApi.addFace(newFaceName, selectedAddFile);
      setNewFaceName("");
      setSelectedAddFile(null);
      if (addFaceFileInputRef.current) addFaceFileInputRef.current.value = "";
      await loadFaces();
    } catch (err) {
      alert("Failed to add face");
    } finally {
      setLoadingDatabase(false);
    }
  };

  const handleDeleteFace = async (name: string) => {
    setDeleting(name);
    try {
      await faceApi.deleteFace(name);
      await loadFaces();
    } catch (err) {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Face Verification */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Face Verification</CardTitle>
          <CardDescription>
            Verify identity using face recognition
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
                    <Button
                      onClick={captureAndVerify}
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
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      className="flex-1"
                    >
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
              <Button
                onClick={verifyViaESP32}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Cpu className="w-4 h-4" />
                )}
                Verify via ESP32
              </Button>
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

      {/* Right Column - Face Database */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Face Database</CardTitle>
          <CardDescription>
            Manage registered faces ({faces.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add face controls */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter person's name"
                value={newFaceName}
                onChange={(e) => setNewFaceName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddFace()}
                disabled={loadingDatabase}
                className="glass-sm"
              />
              <Button
                onClick={handleAddFace}
                disabled={
                  loadingDatabase || !newFaceName.trim() || !selectedAddFile
                }
                className="gap-2"
              >
                {loadingDatabase ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </Button>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addFaceFileInputRef.current?.click()}
                className="flex-1"
              >
                {selectedAddFile ? "Change Image" : "Select Image"}
              </Button>
              <input
                ref={addFaceFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setSelectedAddFile(file || null);
                }}
              />
              {selectedAddFile && (
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {selectedAddFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Face list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {faces.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No faces registered yet</p>
              </div>
            ) : (
              faces.map((face) => (
                <div
                  key={face.id}
                  className="glass-sm p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{face.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {face.addedDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFace(face.name)}
                    disabled={deleting === face.name}
                    className="text-destructive hover:text-destructive"
                  >
                    {deleting === face.name ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
