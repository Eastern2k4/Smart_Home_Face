// src/lib/hooks/useCameraStream.ts
import { useEffect, useState } from "react";

export function useCameraStream() {
  const [streamUrl, setStreamUrl] = useState("");

  useEffect(() => {
    fetch("http://10.133.233.165:5001/camera-url/esp32cam01")
      .then((res) => res.json())
      .then((data) => {
        if (data.stream_url) {
          const relayUrl = `http://10.133.233.165:5001/esp32/stream?camera_url=${encodeURIComponent(
            data.stream_url,
          )}`;
          setStreamUrl(relayUrl);
        }
      })
      .catch((err) => console.error("Failed to fetch stream URL", err));
  }, []);

  return streamUrl;
}
