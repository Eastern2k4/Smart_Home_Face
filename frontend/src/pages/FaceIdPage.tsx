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
      setMessage("Nhập tên chủ nhà trước khi lưu.");
      return;
    }
    if (!selectedFile) {
      setMessage("Chọn ảnh khuôn mặt chủ nhà trước.");
      return;
    }
    setLoading(true);
    try {
      await faceApi.addHostFace(selectedFile, name);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 1,
        action: `Đã thêm khuôn mặt chủ nhà '${name}' vào dữ liệu nhận diện`,
      });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage(`Đã lưu khuôn mặt chủ nhà '${name}' vào database/Hosts.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu khuôn mặt chủ nhà. Kiểm tra backend nhận diện.",
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
        "Trình duyệt chặn camera khi mở bằng IP HTTP. Hãy mở frontend bằng http://localhost:3000 trên chính laptop này.",
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
          ? `Không thể mở camera laptop: ${error.message}`
          : "Không thể mở camera laptop. Kiểm tra quyền truy cập camera.",
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
      setMessage("Nhập tên chủ nhà trước khi chụp.");
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMessage("Camera chưa sẵn sàng.");
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
        if (!blob) throw new Error("Không có dữ liệu ảnh");
        setMessage("Đã chụp ảnh thành công. Đang lưu vào database/Hosts...");
        const file = new File([blob], "host-webcam.jpg", { type: "image/jpeg" });
        await faceApi.addHostFace(file, name);
        store.addEvent({
          timestamp: new Date().toISOString(),
          type: "door",
          value: 1,
          action: `Đã chụp khuôn mặt chủ nhà '${name}' vào dữ liệu nhận diện`,
        });
        setMessage(`Đã chụp và lưu chủ nhà '${name}' vào database/Hosts.`);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Không thể lưu ảnh chủ nhà từ camera laptop.",
        );
      } finally {
        setLoading(false);
      }
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Thêm chủ nhà nhận diện</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Nhập tên chủ nhà, rồi tải ảnh lên hoặc chụp bằng camera máy tính.
          Ảnh hợp lệ sẽ được lưu vào database/Hosts.
        </p>
        <div className="mt-8 grid gap-4">
          <Input
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            placeholder="Tên chủ nhà bắt buộc"
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
              {webcamActive ? "Tắt camera laptop" : "Mở camera laptop"}
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
              Chụp mặt và lưu vào danh sách chủ nhà
            </Button>
          </div>
          <button
            className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 text-center transition-colors hover:bg-primary/10"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-semibold">
              {selectedFile ? selectedFile.name : "Tải ảnh khuôn mặt chủ nhà lên"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">JPG hoặc PNG</p>
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
            Lưu chủ nhà vào database/Hosts
          </Button>
          {message && (
            <p className="rounded-xl bg-secondary p-4 text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Trạng thái cửa</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          {store.doorOpen ? "Cửa đang mở" : "Cửa đang đóng"}
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
          {store.doorOpen ? "Đóng cửa" : "Mở cửa"}
        </Button>
      </div>
    </div>
  );
}

export default FaceIdPage;
