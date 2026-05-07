// lib/hooks/useMuteTimer.ts
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

export function useMuteTimer() {
  const store = useStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (store.buzzerMuteTime > 0) {
      timerRef.current = setInterval(() => {
        store.setBuzzerMuteTime(Math.max(0, store.buzzerMuteTime - 1));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [store.buzzerMuteTime]);
}
