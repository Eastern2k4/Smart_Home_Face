// src/pages/FaceIdPage.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { faceApi } from "@/lib/api/face";
import { sensorApi } from "@/lib/api/sensors";
import { Loader, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";

export function FaceIdPage() {
  const store = useStore();
  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFace = async () => {
    if (!name.trim() || !selectedFile) {
      setMessage("Nhập tên và chọn ảnh khuôn mặt trước.");
      return;
    }
    setLoading(true);
    try {
      await faceApi.addFace(name.trim(), selectedFile);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "door",
        value: 1,
        action: `Added ${name.trim()} to Face ID dataset`,
      });
      setName("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Đã thêm khuôn mặt vào dataset.");
    } catch {
      setMessage("Không thể thêm khuôn mặt. Kiểm tra backend Face ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Thêm Face ID vào dataset</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Dùng ảnh khuôn mặt để đăng ký người được phép mở cửa.
        </p>
        <div className="mt-8 grid gap-4">
          <Input
            className="h-14 rounded-2xl bg-secondary text-lg"
            placeholder="Tên người dùng"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 text-center transition-colors hover:bg-primary/10"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-semibold">
              {selectedFile ? selectedFile.name : "Chọn ảnh khuôn mặt"}
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
            onClick={addFace}
            disabled={loading}
          >
            {loading ? (
              <Loader className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Plus className="mr-2 h-5 w-5" />
            )}
            Thêm vào dataset
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
