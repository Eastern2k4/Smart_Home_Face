'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaceIdTab } from '@/components/tabs/face-id-tab';
import { ControlCenterTab } from '@/components/tabs/control-center-tab';
import { StreamingAnalysisTab } from '@/components/tabs/streaming-analysis-tab';
import { Activity, Gauge, Home, Joystick, ShieldCheck, Wifi } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('face-id');

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Home className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Smart Home IoT Dashboard
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real-time face access, room sensors, lighting control, and analytics
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-96">
              <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Wifi className="size-4 text-primary" />
                  Live
                </div>
                <p className="mt-1 text-muted-foreground">Sensor polling</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Face ID
                </div>
                <p className="mt-1 text-muted-foreground">Door access</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Gauge className="size-4 text-accent" />
                  IoT
                </div>
                <p className="mt-1 text-muted-foreground">ESP32 control</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-3 rounded-lg border border-border bg-card p-1 shadow-sm">
            <TabsTrigger
              value="face-id"
              className="h-11 gap-2 rounded-md text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Face ID</span>
            </TabsTrigger>
            <TabsTrigger
              value="control-center"
              className="h-11 gap-2 rounded-md text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Joystick className="w-4 h-4" />
              <span className="hidden sm:inline">Control Center</span>
            </TabsTrigger>
            <TabsTrigger
              value="streaming"
              className="h-11 gap-2 rounded-md text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="face-id" className="space-y-6">
            <FaceIdTab />
          </TabsContent>

          <TabsContent value="control-center" className="space-y-6">
            <ControlCenterTab />
          </TabsContent>

          <TabsContent value="streaming" className="space-y-6">
            <StreamingAnalysisTab />
          </TabsContent>
        </Tabs>
      </div>

      <footer className="mt-12 border-t border-border/60 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            Smart Home Dashboard - Real-time IoT Control System with Advanced Analytics
          </p>
        </div>
      </footer>
    </main>
  );
}
