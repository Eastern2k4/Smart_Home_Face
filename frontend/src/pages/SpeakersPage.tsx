// src/pages/SpeakersPage.tsx
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { sensorApi } from "@/lib/api/sensors";
import { AudioWaveform, Play, Save } from "lucide-react";
import { useEffect, useState } from "react";

export function SpeakersPage() {
  const [frontVolume, setFrontVolume] = useState(80);
  const [indoorVolume, setIndoorVolume] = useState(60);
  const [frequency, setFrequency] = useState(880);
  const [duration, setDuration] = useState(5000);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    sensorApi
      .getSpeakerSettings()
      .then((settings) => {
        if (!mounted) return;
        setFrontVolume(settings.frontDoorVolume ?? 80);
        setIndoorVolume(settings.indoorVolume ?? 60);
        setFrequency(settings.sineFrequency ?? 880);
        setDuration(settings.alertDurationMs ?? 5000);
      })
      .catch(() => {
        if (mounted) setMessage("Chua ket noi duoc ESP32 sensor.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    setMessage("");
    try {
      await sensorApi.updateSpeakerAudio({
        frontVolume,
        indoorVolume,
        frequency,
        duration,
      });
      setMessage("Da luu am thanh loa dang song sin.");
    } catch {
      setMessage("Khong luu duoc cau hinh loa. Kiem tra backend va ESP32 sensor.");
    } finally {
      setLoading(false);
    }
  };

  const testSpeaker = async (target: "front" | "indoor") => {
    setMessage("");
    try {
      await sensorApi.testSpeaker(target);
      setMessage(target === "front" ? "Dang test loa GPIO27." : "Dang test loa trong nha.");
    } catch {
      setMessage("Khong test duoc loa. Kiem tra ESP32 sensor.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">Loa canh bao cua truoc</h3>
              <p className="mt-1 text-lg text-muted-foreground">GPIO27 - song sin</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => testSpeaker("front")}>
              <Play className="size-5" />
            </Button>
          </div>

          <div className="mt-8 flex justify-between text-lg">
            <span>Am luong</span>
            <span>{frontVolume}%</span>
          </div>
          <Slider
            className="mt-4"
            max={100}
            step={1}
            value={[frontVolume]}
            onValueChange={([value]) => setFrontVolume(value)}
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">Loa trong nha</h3>
              <p className="mt-1 text-lg text-muted-foreground">GPIO14/GPIO13 - song sin</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => testSpeaker("indoor")}>
              <Play className="size-5" />
            </Button>
          </div>

          <div className="mt-8 flex justify-between text-lg">
            <span>Am luong</span>
            <span>{indoorVolume}%</span>
          </div>
          <Slider
            className="mt-4"
            max={100}
            step={1}
            value={[indoorVolume]}
            onValueChange={([value]) => setIndoorVolume(value)}
          />
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AudioWaveform className="size-6 text-primary" />
            <div>
              <h3 className="text-2xl font-bold">Dang song am thanh</h3>
              <p className="mt-1 text-lg text-muted-foreground">Tat ca loa dung song sin PWM.</p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={loading}>
            <Save className="mr-2 size-4" />
            Luu
          </Button>
        </div>

        <div className="mt-8 grid gap-7 md:grid-cols-2">
          <div>
            <div className="flex justify-between text-lg">
              <span>Tan so</span>
              <span>{frequency} Hz</span>
            </div>
            <Slider
              className="mt-4"
              min={100}
              max={3000}
              step={10}
              value={[frequency]}
              onValueChange={([value]) => setFrequency(value)}
            />
          </div>
          <div>
            <div className="flex justify-between text-lg">
              <span>Thoi luong canh bao</span>
              <span>{(duration / 1000).toFixed(1)}s</span>
            </div>
            <Slider
              className="mt-4"
              min={500}
              max={30000}
              step={500}
              value={[duration]}
              onValueChange={([value]) => setDuration(value)}
            />
          </div>
        </div>

        {message ? <p className="mt-6 text-base text-muted-foreground">{message}</p> : null}
      </section>
    </div>
  );
}

export default SpeakersPage;
