// src/app/page.tsx or src/App.tsx
"use client";

import { useState } from "react";
import { MainLayout } from "@/layouts/MainLayout";
import { OverviewPage } from "@/pages/OverviewPage";
import { SensorsPage } from "@/pages/SensorsPage";
import { LightsPage } from "@/pages/LightsPage";
import { CameraPage } from "@/pages/CameraPage";
import { FaceIdPage } from "@/pages/FaceIdPage";
import { SpeakersPage } from "@/pages/SpeakersPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { SettingsPage } from "@/pages/SettingsPage";

type PageId =
  | "overview"
  | "sensors"
  | "lights"
  | "camera"
  | "face-id"
  | "speakers"
  | "alerts"
  | "settings";

export default function SmartHomeDashboard() {
  const [activePage, setActivePage] = useState<PageId>("overview");

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return <OverviewPage />;
      case "sensors":
        return <SensorsPage />;
      case "lights":
        return <LightsPage />;
      case "camera":
        return <CameraPage />;
      case "face-id":
        return <FaceIdPage />;
      case "speakers":
        return <SpeakersPage />;
      case "alerts":
        return <AlertsPage />;
        {
          /* case "settings": */
        }
        {
          /*   return <SettingsPage />; */
        }
      default:
        return <OverviewPage />;
    }
  };

  return (
    <MainLayout activePage={activePage} setActivePage={setActivePage}>
      {renderPage()}
    </MainLayout>
  );
}
