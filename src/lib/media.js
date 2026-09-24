import { staticMedia } from "./staticMedia.js";
import { useEffect, useState } from "react";

export const mediaServerEnabled = import.meta.env.VITE_MEDIA_BACKEND === "server";

export async function mediaRequest(path = "", options = {}) {
  if (!mediaServerEnabled) {
    if (path === "" && (!options.method || options.method === "GET")) {
      return { items: staticMedia };
    }
    throw new Error("Uploads are not enabled yet. The published gallery is available below.");
  }
  const response = await fetch(`/api/media${path}`, { credentials: "same-origin", ...options });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Media storage is not connected yet.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load media. Please try again.");
  return data;
}

export function useMedia() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    mediaRequest("", { signal: controller.signal }).then(data => setItems(data.items))
      .catch(err => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return { items, loading, error, refresh: () => { setLoading(true); setError(""); setRevision(v => v + 1); } };
}
