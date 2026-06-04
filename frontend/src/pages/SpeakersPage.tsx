// src/pages/SpeakersPage.tsx
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { sensorApi, type SpeakerTarget } from "@/lib/api/sensors";
import { AudioWaveform, Play, Save } from "lucide-react";
import { useEffect, useState } from "react";

type SpeakerState = {
  active?: boolean;
  volume?: number;
  frequency?: number;
  reason?: string | null;
};

type SpeakerSettings = {
  alertDurationMs?: number;
  speakers?: Record<SpeakerTarget, SpeakerState>;
};

const speakerCards: Array<{
  target: SpeakerTarget;
  title: string;
  purpose: string;
  pin: string;
}> = [
  {
    target: "front_door",
    title: "Front Door Stranger Alarm",
    purpose: "Backend recognition triggers this after 5 stranger frames.",
    pin: "GPIO27",
  },
  {
    target: "house_gas",
    title: "House Gas Alarm",
    purpose: "ESP32 Sensor Node triggers this locally when gas is unsafe.",
    pin: "GPIO14",
  },
];

export function SpeakersPage() {
  const [frontVolume, setFrontVolume] = useState(80);
  const [houseGasVolume, setHouseGasVolume] = useState(75);
  const [frontFrequency, setFrontFrequency] = useState(880);
  const [houseGasFrequency, setHouseGasFrequency] = useState(1200);
  const [duration, setDuration] = useState(5000);
  const [speakerState, setSpeakerState] = useState<
    Partial<Record<SpeakerTarget, SpeakerState>>
  >({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    sensorApi
      .getSpeakerSettings()
      .then((settings: SpeakerSettings) => {
        if (!mounted) return;
        const frontDoor = settings.speakers?.front_door;
        const houseGas = settings.speakers?.house_gas;
        setFrontVolume(frontDoor?.volume ?? 80);
        setHouseGasVolume(houseGas?.volume ?? 75);
        setFrontFrequency(frontDoor?.frequency ?? 880);
        setHouseGasFrequency(houseGas?.frequency ?? 1200);
        setDuration(settings.alertDurationMs ?? 5000);
        setSpeakerState(settings.speakers ?? {});
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
      const settings = await sensorApi.updateSpeakerAudio({
        frontVolume,
        houseGasVolume,
        frontFrequency,
        houseGasFrequency,
        duration,
      });
      setSpeakerState(settings.speakers ?? {});
      setMessage("Da luu cau hinh 2 loa canh bao.");
    } catch {
      setMessage("Khong luu duoc cau hinh loa. Kiem tra backend va ESP32 sensor.");
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
          ? "Dang test loa front_door tren GPIO27."
          : "Dang test loa house_gas tren GPIO14.",
      );
    } catch {
      setMessage("Khong test duoc loa. Kiem tra ESP32 sensor.");
    }
  };

  const volumeFor = (target: SpeakerTarget) =>
    target === "front_door" ? frontVolume : houseGasVolume;
  const setVolumeFor = (target: SpeakerTarget, value: number) =>
    target === "front_door"
      ? setFrontVolume(value)
      : setHouseGasVolume(value);
  const frequencyFor = (target: SpeakerTarget) =>
    target === "front_door" ? frontFrequency : houseGasFrequency;
  const setFrequencyFor = (target: SpeakerTarget, value: number) =>
    target === "front_door"
      ? setFrontFrequency(value)
      : setHouseGasFrequency(value);

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
                  <span>Active</span>
                  <span>{state?.active ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reason</span>
                  <span>{state?.reason ?? "none"}</span>
                </div>
              </div>

              <div className="mt-8 flex justify-between text-lg">
                <span>Volume</span>
                <span>{volumeFor(speaker.target)}%</span>
              </div>
              <Slider
                className="mt-4"
                max={100}
                step={1}
                value={[volumeFor(speaker.target)]}
                onValueChange={([value]) => setVolumeFor(speaker.target, value)}
              />

              <div className="mt-7 flex justify-between text-lg">
                <span>Frequency</span>
                <span>{frequencyFor(speaker.target)} Hz</span>
              </div>
              <Slider
                className="mt-4"
                min={100}
                max={3000}
                step={10}
                value={[frequencyFor(speaker.target)]}
                onValueChange={([value]) =>
                  setFrequencyFor(speaker.target, value)
                }
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
              <h3 className="text-2xl font-bold">Speaker Timing</h3>
              <p className="mt-1 text-lg text-muted-foreground">
                Stranger/manual tests are timed. Gas stays active while unsafe.
              </p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={loading}>
            <Save className="mr-2 size-4" />
            Luu
          </Button>
        </div>

        <div className="mt-8">
          <div className="flex justify-between text-lg">
            <span>Timed alert duration</span>
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

        {message ? (
          <p className="mt-6 text-base text-muted-foreground">{message}</p>
        ) : null}
      </section>
    </div>
  );
}

export default SpeakersPage;
