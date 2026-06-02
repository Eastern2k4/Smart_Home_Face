// src/pages/FaceIdPage.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { faceApi } from "@/lib/api/face";
import { sensorApi } from "@/lib/api/sensors";
import { Camera, Loader, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function FaceIdPage() {
  const store = useStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hostName, setHostName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  useEffect(() => {
    return () => {
      webcamStream?.getTracks().forEach((track) => track.stop());
    };
  }, [webcamStream]);

  const addHostFace = async () => {
    const name = hostName.trim();
    if (!name) {
      setMessage("Nhap ten Host truoc khi luu.");
      return;
    }
    if (!selectedFile) {
      setMessage("Chon anh khuon mat Host truoc.");
      return;
    }
    setLoading(true);
    try {
      await faceApi.addHostFace(selectedFile, name);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 1,
        action: `Added Host face '${name}' to Face ID dataset`,
      });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage(`Da luu khuon mat Host '${name}' vao database/Hosts.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Khong the luu khuon mat Host. Kiem tra backend Face ID.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startWebcam = async () => {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!window.isSecureContext && !isLocalhost) {
      setMessage(
        "Trinh duyet chan camera khi mo bang IP HTTP. Hay mo frontend bang http://localhost:3000 tren chinh laptop nay.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setWebcamStream(stream);
      setWebcamActive(true);
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Khong the mo camera laptop: ${error.message}`
          : "Khong the mo camera laptop. Kiem tra quyen truy cap camera.",
      );
    }
  };

  const stopWebcam = () => {
    webcamStream?.getTracks().forEach((track) => track.stop());
    setWebcamStream(null);
    setWebcamActive(false);
  };

  const captureHostFromWebcam = async () => {
    const name = hostName.trim();
    if (!name) {
      setMessage("Nhap ten Host truoc khi chup.");
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMessage("Camera chua san sang.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);

    setLoading(true);
    canvas.toBlob(async (blob) => {
      try {
        if (!blob) throw new Error("No image data");
        setMessage("Da chup anh thanh cong. Dang luu vao database/Hosts...");
        const file = new File([blob], "host-webcam.jpg", { type: "image/jpeg" });
        await faceApi.addHostFace(file, name);
        store.addEvent({
          timestamp: new Date().toISOString(),
          type: "door",
          value: 1,
          action: `Captured Host face '${name}' to Face ID dataset`,
        });
        setMessage(`Da chup va luu Host '${name}' vao database/Hosts.`);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Khong the luu anh Host tu camera laptop.",
        );
      } finally {
        setLoading(false);
      }
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Them Host Face ID</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Nhap ten bat buoc, roi upload anh hoac chup bang camera may tinh.
          Anh hop le se duoc luu vao database/Hosts.
        </p>
        <div className="mt-8 grid gap-4">
          <Input
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            placeholder="Ten Host bat buoc"
            className="h-12"
          />
          {webcamActive && (
            <div className="overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-contain"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={webcamActive ? stopWebcam : startWebcam}
            >
              <Camera className="mr-2 h-5 w-5" />
              {webcamActive ? "Tat camera laptop" : "Mo camera laptop"}
            </Button>
            <Button
              type="button"
              className="h-12"
              onClick={captureHostFromWebcam}
              disabled={!webcamActive || loading || !hostName.trim()}
            >
              {loading ? (
                <Loader className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Camera className="mr-2 h-5 w-5" />
              )}
              Chup mat va luu vao Hosts
            </Button>
          </div>
          <button
            className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 text-center transition-colors hover:bg-primary/10"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-semibold">
              {selectedFile ? selectedFile.name : "Upload anh khuon mat Host"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">JPG hoac PNG</p>
          </button>
          <input
            ref={fileRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <Button
            className="h-14 rounded-2xl text-lg"
            onClick={addHostFace}
            disabled={loading || !selectedFile || !hostName.trim()}
          >
            {loading ? (
              <Loader className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Plus className="mr-2 h-5 w-5" />
            )}
            Luu Host vao database/Hosts
          </Button>
          {message && (
            <p className="rounded-xl bg-secondary p-4 text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Trang thai cua</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          {store.doorOpen ? "Cua dang mo" : "Cua dang dong"}
        </p>
        <Button
          className="mt-8 h-14 rounded-2xl px-8 text-lg"
          variant="outline"
          onClick={() =>
            sensorApi
              .setDoor(!store.doorOpen)
              .then(() => store.setDoorState(!store.doorOpen))
          }
        >
          {store.doorOpen ? "Dong cua" : "Mo cua"}
        </Button>
      </div>
    </div>
  );
}

export default FaceIdPage;
