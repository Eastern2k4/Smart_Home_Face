// src/components/LightCard.tsx
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Lightbulb, Loader, Zap } from "lucide-react";

type LightId = "wc" | "kitchen" | "bedroom";

export function LightCard({
  id,
  name,
  room,
  enabled,
  autoMode,
  threshold,
  onToggle,
  onAutoChange,
  onThresholdChange,
  busy = false,
}: {
  id: LightId;
  name: string;
  room: string;
  enabled: boolean;
  autoMode?: boolean;
  threshold?: number;
  onToggle: (id: LightId, checked: boolean) => void;
  onAutoChange?: (checked: boolean) => void;
  onThresholdChange?: (value: number) => void;
  busy?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-7 transition-all",
        enabled
          ? "border-primary shadow-lg shadow-primary/10"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "rounded-xl p-4",
              enabled ? "bg-primary/20" : "bg-muted",
            )}
          >
            <Lightbulb
              className={cn(
                "h-7 w-7",
                enabled ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-foreground">{name}</h3>
            <p className="text-lg text-muted-foreground">{room}</p>
          </div>
        </div>
        <Button
          size="lg"
          disabled={busy}
          className={cn(
            "h-14 rounded-full px-5",
            enabled
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground hover:bg-secondary",
          )}
          onClick={() => onToggle(id, !enabled)}
        >
          {busy ? (
            <Loader className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Zap className="mr-2 h-5 w-5" />
          )}
          {enabled ? "Tắt" : "Bật"}
        </Button>
      </div>

      {onAutoChange && (
        <div className="mt-7 flex items-center justify-between">
          <span className="text-lg text-muted-foreground">Chế độ tự động</span>
          <Switch checked={!!autoMode} onCheckedChange={onAutoChange} />
        </div>
      )}

      {autoMode && threshold !== undefined && onThresholdChange && (
        <div className="mt-6 space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-muted-foreground">Ngưỡng bật</span>
            <span className="font-semibold text-foreground">
              {threshold} cm
            </span>
          </div>
          <Slider
            value={[threshold]}
            min={1}
            max={80}
            step={1}
            onValueChange={([value]) => onThresholdChange(value)}
          />
        </div>
      )}
    </div>
  );
}
