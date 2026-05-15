// src/layouts/MainLayout.tsx
import { Bell, Home, LayoutDashboard, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

type PageId =
  | "overview"
  | "sensors"
  | "lights"
  | "camera"
  | "face-id"
  | "speakers"
  | "alerts"
  | "settings";

const navItems: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "sensors", label: "Cảm biến", icon: Thermometer },
  { id: "lights", label: "Đèn", icon: Lightbulb },
  { id: "camera", label: "Cửa ra vào", icon: Camera },
  { id: "face-id", label: "Face ID", icon: UserCheck },
  { id: "speakers", label: "Loa", icon: Speaker },
  { id: "alerts", label: "Cảnh báo", icon: Bell },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

const titles: Record<PageId, string> = {
  overview: "Tổng quan",
  sensors: "Cảm biến",
  lights: "Điều khiển đèn",
  camera: "Cửa ra vào",
  "face-id": "Face ID",
  speakers: "Hệ thống loa",
  alerts: "Cảnh báo",
  settings: "Cài đặt",
};

function formatDate() {
  return new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MainLayout({
  activePage,
  setActivePage,
  children,
}: {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  children: React.ReactNode;
}) {
  const store = useStore();
  const alertCount = store.gasAlertActive ? 1 : 0;

  return (
    <main className="grid min-h-screen overflow-x-hidden bg-background text-foreground md:grid-cols-[360px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="hidden min-h-screen border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="grid h-24 grid-cols-[1fr_40px] items-center border-b border-sidebar-border px-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary">
              <Home className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="truncate text-3xl font-bold text-sidebar-foreground">
              SmartHome
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-3 p-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={cn(
                  "flex w-full items-center gap-5 rounded-2xl px-5 py-4 text-xl font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-7 w-7 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-success" />
              <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-success opacity-75" />
            </div>
            <span className="text-lg text-muted-foreground">Kết nối MQTT</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <section className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-6 backdrop-blur-sm lg:px-10">
          <div className="grid h-24 grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(240px,1fr)_auto]">
            <div className="min-w-0">
              <div className="mb-4 grid grid-cols-4 gap-2 md:hidden">
                {navItems.slice(0, 4).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      className={cn(
                        "rounded-xl p-3",
                        activePage === item.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary",
                      )}
                    >
                      <Icon className="mx-auto h-5 w-5" />
                    </button>
                  );
                })}
              </div>
              <h1 className="break-words text-3xl font-bold text-foreground lg:text-4xl">
                {titles[activePage]}
              </h1>
              <p className="mt-1 text-xl text-muted-foreground">
                {formatDate()}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative hidden lg:block">
                <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Tìm kiếm..."
                  className="h-14 w-[min(28vw,460px)] rounded-2xl border border-input bg-secondary pl-14 pr-5 text-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button className="relative rounded-2xl p-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <Bell className="h-7 w-7" />
                {alertCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-sm font-bold text-destructive-foreground">
                    {alertCount}
                  </span>
                )}
              </button>
              <button className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-7 w-7" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10">{children}</div>
      </section>
    </main>
  );
}

// Missing imports for icons used in navItems
import {
  Thermometer,
  Lightbulb,
  Camera,
  UserCheck,
  Speaker,
  Settings,
} from "lucide-react";
