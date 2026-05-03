'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaceIdTab } from '@/components/tabs/face-id-tab';
import { ControlCenterTab } from '@/components/tabs/control-center-tab';
import { StreamingAnalysisTab } from '@/components/tabs/streaming-analysis-tab';
import { Home, Joystick, Activity } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('face-id');

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <Home className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Smart Home IoT Dashboard</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Real-time monitoring and control with face recognition</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="face-id" className="gap-2 flex items-center cursor-pointer pointer-events-auto">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Face ID</span>
            </TabsTrigger>
            <TabsTrigger value="control-center" className="gap-2 flex items-center cursor-pointer pointer-events-auto">
              <Joystick className="w-4 h-4" />
              <span className="hidden sm:inline">Control Center</span>
            </TabsTrigger>
            <TabsTrigger value="streaming" className="gap-2 flex items-center cursor-pointer pointer-events-auto">
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

      {/* Footer */}
      <footer className="border-t border-border/40 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-muted-foreground">
            Smart Home Dashboard · Real-time IoT Control System with Advanced Analytics
          </p>
        </div>
      </footer>
    </main>
  );
}
