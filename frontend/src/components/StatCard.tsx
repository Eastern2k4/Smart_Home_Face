// src/components/StatCard.tsx
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  status = "normal",
  badge,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  status?: "normal" | "warning" | "danger";
  badge?: string;
}) {
  const tone = {
    normal: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[status];

  return (
    <div className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className={cn("rounded-xl p-3", tone)}>
          <Icon className="h-6 w-6" />
        </div>
        {badge && (
          <span
            className={cn("rounded-full px-3 py-1 text-sm font-semibold", tone)}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-7">
        <p className="text-lg text-muted-foreground">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-5xl font-bold leading-none text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-xl text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}
