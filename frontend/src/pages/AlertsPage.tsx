// src/pages/AlertsPage.tsx
import { useStore } from "@/lib/store";
import { Switch } from "@/components/ui/switch";

export function AlertsPage() {
  const store = useStore();

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Cài đặt ngưỡng cảnh báo</h2>
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-border p-6">
            <div>
              <h3 className="text-2xl font-semibold">Cảnh báo khí gas</h3>
              <p className="text-lg text-muted-foreground">
                Phát cảnh báo khi nồng độ gas vượt ngưỡng
              </p>
            </div>
            <div className="flex items-center gap-6 text-xl text-muted-foreground">
              <span>Ngưỡng: {store.gasThreshold} ppm</span>
              <Switch checked />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-bold">Lịch sử cảnh báo</h2>
        <div className="mt-6 space-y-4">
          {store.events.length === 0 ? (
            <p className="text-muted-foreground">Chưa có sự kiện nào.</p>
          ) : (
            store.events.slice(0, 6).map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className="flex items-center gap-5 rounded-xl border border-warning/30 bg-warning/5 p-4"
              >
                <span className="text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString("vi-VN")}
                </span>
                <span className="rounded bg-warning/20 px-3 py-1 text-sm font-semibold text-warning">
                  {event.type}
                </span>
                <span className="text-foreground">{event.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AlertsPage;
