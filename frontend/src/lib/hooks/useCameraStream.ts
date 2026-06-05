// src/lib/hooks/useCameraStream.ts
import { useEffect, useState } from "react";

function getApiBases() {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return [process.env.NEXT_PUBLIC_BACKEND_URL];
  }

  return [
    `${window.location.protocol}//${window.location.hostname}:8000`,
    "http://localhost:8000",
  ];
}

export function useCameraStream() {
  const [streamUrl, setStreamUrl] = useState("");
  const [cameraSource, setCameraSource] = useState<"esp32" | "laptop" | "unknown">(
    "unknown",
  );

  useEffect(() => {
    const apiBases = getApiBases();

    const fetchStreamUrl = async () => {
      for (const apiBase of apiBases) {
        try {
          const statusRes = await fetch(`${apiBase}/api/camera/recognition-status`);
          if (statusRes.ok) {
            const status = await statusRes.json();
            const source = status.camera_source ?? "unknown";
            setCameraSource(source);

            if (source === "laptop") {
              setStreamUrl(`${apiBase}/api/esp32/stream`);
              return;
            }
          }

          const res = await fetch(`${apiBase}/api/arduino/status`);
          if (!res.ok) continue;

          const data = await res.json();
          const directStreamUrl =
            data.camera_node?.stream_url || data.camera_node?.device?.stream_url;

          if (data.camera_node?.connected && directStreamUrl) {
            setCameraSource("esp32");
            setStreamUrl(directStreamUrl);
            return;
          }
        } catch (err) {
          console.error("Failed to fetch stream URL", err);
        }
      }

      setCameraSource("unknown");
      setStreamUrl("");
    };

    fetchStreamUrl();
    const interval = window.setInterval(fetchStreamUrl, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return { streamUrl, cameraSource };
}
