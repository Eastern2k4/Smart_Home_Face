// src/pages/SpeakersPage.tsx
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

export function SpeakersPage() {
  const [speakerOne, setSpeakerOne] = useState(50);
  const [speakerTwo, setSpeakerTwo] = useState(0);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-7">
        <h3 className="text-2xl font-bold">Loa phòng khách</h3>
        <p className="mt-1 text-lg text-muted-foreground">Âm lượng hệ thống</p>
        <div className="mt-8 flex justify-between text-lg">
          <span>Âm lượng</span>
          <span>{speakerOne}%</span>
        </div>
        <Slider
          className="mt-4"
          value={[speakerOne]}
          onValueChange={([value]) => setSpeakerOne(value)}
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-7">
        <h3 className="text-2xl font-bold">Loa cảnh báo</h3>
        <p className="mt-1 text-lg text-muted-foreground">
          Dùng cho cảnh báo gas
        </p>
        <div className="mt-8 flex justify-between text-lg">
          <span>Âm lượng</span>
          <span>{speakerTwo}%</span>
        </div>
        <Slider
          className="mt-4"
          value={[speakerTwo]}
          onValueChange={([value]) => setSpeakerTwo(value)}
        />
      </div>
    </div>
  );
}

export default SpeakersPage;
