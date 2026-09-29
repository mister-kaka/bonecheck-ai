import { useEffect, useState } from "react";
import { API_BASE_URL } from "./client";

export function studyHeatmapUrl(studyId: string): string {
  return `${API_BASE_URL}/api/studies/${studyId}/heatmap`;
}

export function useHeatmapUrls(studyId: string | undefined): string[] | undefined {
  const [urls, setUrls] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    if (!studyId) {
      setUrls(undefined);
      return;
    }

    let cancelled = false;
    setUrls(undefined);
    const url = studyHeatmapUrl(studyId);
    const timeout = AbortSignal.timeout(20_000);

    fetch(url, { method: "HEAD", signal: timeout })
      .then((response) => {
        if (!cancelled) setUrls(response.ok ? [url] : undefined);
      })
      .catch(() => {
        if (!cancelled) setUrls(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [studyId]);

  return urls;
}
