// src/pages/LightsPage.tsx
import { LightCard } from "@/components/LightCard";
import { useAutoLED } from "@/lib/hooks/useAutoLED";
import { useSensorPolling } from "@/lib/hooks/useSensorPolling";
import { useStore } from "@/lib/store";
import { sensorApi } from "@/lib/api/sensors";
import { useState } from "react";

type LightId = "wc" | "kitchen" | "bedroom";

export function LightsPage() {
  useSensorPolling();
  useAutoLED();
  const store = useStore();
  const [lightBusy, setLightBusy] = useState<Partial<Record<LightId, boolean>>>(
    {},
  );

  const toggleLight = async (id: LightId, checked: boolean) => {
    setLightBusy((prev) => ({ ...prev, [id]: true }));
    store.setLedState(id, checked);
    try {
      await sensorApi.toggleLED(id, checked);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "led",
        value: checked ? 1 : 0,
        action: `${id} light turned ${checked ? "ON" : "OFF"}`,
      });
    } catch (error) {
      console.error(`Failed to toggle ${id} light`, error);
      store.addEvent({
        timestamp: new Date().toISOString(),
        type: "led",
        value: checked ? 1 : 0,
        action: `Failed to toggle ${id} light`,
      });
    } finally {
      setLightBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const setAutoMode = async (id: "wc" | "kitchen", checked: boolean) => {
    store.setAutoLed(id, checked);
    if (!checked) {
      await toggleLight(id, false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <LightCard
        id="bedroom"
        name="Đèn phòng ngủ"
        room="Phòng ngủ chính"
        enabled={store.leds.bedroom}
        onToggle={toggleLight}
        busy={!!lightBusy.bedroom}
      />
      <LightCard
        id="kitchen"
        name="Đèn phòng bếp"
        room="Phòng bếp"
        enabled={store.leds.kitchen}
        autoMode={store.autoLed.kitchen}
        threshold={store.ledThresholds.kitchen}
        onToggle={toggleLight}
        onAutoChange={(checked) => setAutoMode("kitchen", checked)}
        onThresholdChange={(value) => store.setLedThreshold("kitchen", value)}
        busy={!!lightBusy.kitchen}
      />
      <LightCard
        id="wc"
        name="Đèn phòng vệ sinh"
        room="Phòng vệ sinh"
        enabled={store.leds.wc}
        autoMode={store.autoLed.wc}
        threshold={store.ledThresholds.wc}
        onToggle={toggleLight}
        onAutoChange={(checked) => setAutoMode("wc", checked)}
        onThresholdChange={(value) => store.setLedThreshold("wc", value)}
        busy={!!lightBusy.wc}
      />
    </div>
  );
}
