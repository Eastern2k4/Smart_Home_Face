// src/lib/hooks/useCameraStream.ts
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export function useCameraStream() {
  const [streamUrl, setStreamUrl] = useState("");

  useEffect(() => {
    const fetchStreamUrl = () => {
      fetch(`${API_BASE}/api/arduino/status`)
        .then((res) => res.json())
        .then((data) => {
          const directStreamUrl =
            data.camera_node?.stream_url || data.camera_node?.device?.stream_url;

          if (data.camera_node?.connected && directStreamUrl) {
            setStreamUrl(directStreamUrl);
          } else {
            setStreamUrl("");
          }
        })
        .catch((err) => {
          console.error("Failed to fetch stream URL", err);
          setStreamUrl("");
        });
    };

    fetchStreamUrl();
    const interval = window.setInterval(fetchStreamUrl, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return streamUrl;
}
