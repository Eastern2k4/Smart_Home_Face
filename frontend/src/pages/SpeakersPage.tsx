// src/pages/SpeakersPage.tsx
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { sensorApi, type SpeakerTarget } from "@/lib/api/sensors";
import { useStore } from "@/lib/store";
import { AudioWaveform, Play, Save } from "lucide-react";
import { useEffect, useState } from "react";

type SpeakerState = {
  active?: boolean;
  volume?: number;
  reason?: string | null;
};

type SpeakerSettings = {
  alertDurationMs?: number;
  gasThreshold?: number;
  thresholds?: {
    gas?: number;
    temperature?: number;
    humidity?: number;
  };
  speakers?: Record<SpeakerTarget, SpeakerState>;
};

const reasonText = (reason?: string | null) => {
  const labels: Record<string, string> = {
    stranger_5_frames: "Người lạ đủ 5 khung hình",
    gas_threshold_exceeded: "Khí gas vượt ngưỡng",
    temperature_threshold_exceeded: "Nhiệt độ vượt ngưỡng",
    humidity_threshold_exceeded: "Độ ẩm vượt ngưỡng",
    manual_test: "Đang kiểm tra thủ công",
  };
  return reason ? labels[reason] ?? reason : "Không có";
};

const speakerCards: Array<{
  target: SpeakerTarget;
  title: string;
  purpose: string;
  pin: string;
}> = [
  {
    target: "front_door",
    title: "Loa cảnh báo cửa trước",
    purpose: "Backend kích hoạt khi nhận diện người lạ đủ 5 khung hình.",
    pin: "GPIO27",
  },
  {
    target: "house_gas",
    title: "Loa cảnh báo môi trường",
    purpose:
      "ESP32 Sensor Node kích hoạt cục bộ khi khí gas, nhiệt độ hoặc độ ẩm vượt ngưỡng.",
    pin: "GPIO14 + GPIO13",
  },
];

export function SpeakersPage() {
  const [frontVolume, setFrontVolume] = useState(100);
  const [houseGasVolume, setHouseGasVolume] = useState(75);
  const [duration, setDuration] = useState(5000);
  const [gasThreshold, setGasThreshold] = useState(500);
  const [temperatureThreshold, setTemperatureThreshold] = useState(50);
  const [humidityThreshold, setHumidityThreshold] = useState(80);
  const [speakerState, setSpeakerState] = useState<
    Partial<Record<SpeakerTarget, SpeakerState>>
  >({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const setStoreGasThreshold = useStore((state) => state.setGasThreshold);

  useEffect(() => {
    let mounted = true;

    sensorApi
      .getSpeakerSettings()
      .then((settings: SpeakerSettings) => {
        if (!mounted) return;
        const frontDoor = settings.speakers?.front_door;
        const houseGas = settings.speakers?.house_gas;
        setFrontVolume(frontDoor?.volume ?? 100);
        setHouseGasVolume(houseGas?.volume ?? 75);
        setDuration(settings.alertDurationMs ?? 5000);
        const loadedGasThreshold =
          settings.thresholds?.gas ?? settings.gasThreshold ?? 500;
        setGasThreshold(loadedGasThreshold);
        setStoreGasThreshold(loadedGasThreshold);
        setTemperatureThreshold(settings.thresholds?.temperature ?? 50);
        setHumidityThreshold(settings.thresholds?.humidity ?? 80);
        setSpeakerState(settings.speakers ?? {});
      })
      .catch(() => {
        if (mounted) setMessage("Chưa kết nối được ESP32 sensor.");
      });

    return () => {
      mounted = false;
    };
  }, [setStoreGasThreshold]);

  const saveSettings = async () => {
    setLoading(true);
    setMessage("");
    try {
      const settings = await sensorApi.updateSpeakerAudio({
        frontVolume,
        houseGasVolume,
        duration,
        gasThreshold,
        temperatureThreshold,
        humidityThreshold,
      });
      setSpeakerState(settings.speakers ?? {});
      setStoreGasThreshold(gasThreshold);
      setMessage("Đã lưu cấu hình loa và ngưỡng cảnh báo.");
    } catch {
      setMessage(
        "Không lưu được cấu hình loa. Kiểm tra backend và ESP32 sensor.",
      );
    } finally {
      setLoading(false);
    }
  };

  const testSpeaker = async (target: SpeakerTarget) => {
    setMessage("");
    try {
      await sensorApi.testSpeaker(target);
      setMessage(
        target === "front_door"
          ? "Đang kiểm tra loa cửa trước trên GPIO27."
          : "Đang kiểm tra loa môi trường trên GPIO14 và GPIO13.",
      );
    } catch {
      setMessage("Không kiểm tra được loa. Kiểm tra ESP32 sensor.");
    }
  };

  const volumeFor = (target: SpeakerTarget) =>
    target === "front_door" ? frontVolume : houseGasVolume;
  const setVolumeFor = (target: SpeakerTarget, value: number) =>
    target === "front_door" ? setFrontVolume(value) : setHouseGasVolume(value);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {speakerCards.map((speaker) => {
          const state = speakerState[speaker.target];
          return (
            <section
              key={speaker.target}
              className="rounded-xl border border-border bg-card p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold">{speaker.title}</h3>
                  <p className="mt-1 text-lg text-muted-foreground">
                    {speaker.target} - {speaker.pin}
                  </p>
                  <p className="mt-3 text-base text-muted-foreground">
                    {speaker.purpose}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => testSpeaker(speaker.target)}
                >
                  <Play className="size-5" />
                </Button>
              </div>

              <div className="mt-6 grid gap-3 text-base text-muted-foreground">
                <div className="flex justify-between">
                  <span>Trạng thái</span>
                  <span>{state?.active ? "Đang bật" : "Đang tắt"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lý do</span>
                  <span>{reasonText(state?.reason)}</span>
                </div>
              </div>

              <div className="mt-8 flex justify-between text-lg">
                <span>Âm lượng</span>
                <span>{volumeFor(speaker.target)}%</span>
              </div>
              <Slider
                className="mt-4"
                max={100}
                step={1}
                value={[volumeFor(speaker.target)]}
                onValueChange={([value]) => setVolumeFor(speaker.target, value)}
              />
            </section>
          );
        })}
      </div>

      <section className="rounded-xl border border-border bg-card p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AudioWaveform className="size-6 text-primary" />
            <div>
              <h3 className="text-2xl font-bold">Thời lượng loa</h3>
              <p className="mt-1 text-lg text-muted-foreground">
                Cảnh báo cửa trước có thời lượng. Cảnh báo môi trường bật khi
                giá trị vượt ngưỡng.
              </p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={loading}>
            <Save className="mr-2 size-4" />
            Lưu
          </Button>
        </div>

        <div className="mt-8">
          <div className="flex justify-between text-lg">
            <span>Thời lượng cảnh báo</span>
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

        <div className="mt-8 grid gap-7">
          <div>
            <div className="flex justify-between text-lg">
              <span>Ngưỡng khí gas</span>
              <span>{gasThreshold}</span>
            </div>
            <Slider
              className="mt-4"
              min={0}
              max={5000}
              step={10}
              value={[gasThreshold]}
              onValueChange={([value]) => setGasThreshold(value)}
            />
          </div>

          <div>
            <div className="flex justify-between text-lg">
              <span>Ngưỡng nhiệt độ</span>
              <span>{temperatureThreshold}°C</span>
            </div>
            <Slider
              className="mt-4"
              min={20}
              max={80}
              step={1}
              value={[temperatureThreshold]}
              onValueChange={([value]) => setTemperatureThreshold(value)}
            />
          </div>

          <div>
            <div className="flex justify-between text-lg">
              <span>Ngưỡng độ ẩm</span>
              <span>{humidityThreshold}%</span>
            </div>
            <Slider
              className="mt-4"
              min={30}
              max={100}
              step={1}
              value={[humidityThreshold]}
              onValueChange={([value]) => setHumidityThreshold(value)}
            />
          </div>
        </div>

        {message ? (
          <p className="mt-6 text-base text-muted-foreground">{message}</p>
        ) : null}
      </section>
    </div>
  );
}

export default SpeakersPage;
