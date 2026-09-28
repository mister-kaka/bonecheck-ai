import { useEffect, useRef, useState } from "react";
import { ApiRequestError, getStudy, getStudyFile, getStudyResult, messageFromError } from "../../api/client";
import { isAbort, wait } from "../../api/wait";
import type { StudyListItem, StudyResultPayload } from "../../types/study";

const POLL_INTERVAL_MS = 1000;

export type LoadedStudy =
  | { source: "loading" }
  | { source: "api"; study: StudyListItem; result: StudyResultPayload | null }
  | { source: "missing"; message: string };

export type SnapshotState = "idle" | "ready" | "missing";

export function useStudyCard(id: string, onLoadStart?: () => void) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedStudy>({ source: "loading" });
  const [snapshot, setSnapshot] = useState<File | null>(null);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>("idle");
  const onLoadStartRef = useRef(onLoadStart);
  onLoadStartRef.current = onLoadStart;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoaded({ source: "loading" });
    onLoadStartRef.current?.();

    void (async () => {
      try {
        let study = await getStudy(id, controller.signal);
        while (active && study.status === "processing") {
          setLoaded({ source: "api", study, result: null });
          await wait(POLL_INTERVAL_MS, controller.signal);
          study = await getStudy(id, controller.signal);
        }
        if (!active) return;

        if (study.status !== "completed" || !study.hasResult) {
          setLoaded({ source: "api", study, result: null });
          return;
        }

        try {
          const result = await getStudyResult(id, controller.signal);
          if (active) setLoaded({ source: "api", study, result });
        } catch (error) {
          if (!active || isAbort(error)) return;
          if (error instanceof ApiRequestError && error.code === "ANALYSIS_FAILED") {
            setLoaded({
              source: "api",
              study: {
                ...study,
                status: "error",
                error: error.message,
                hasResult: false,
              },
              result: null,
            });
            return;
          }
          if (error instanceof ApiRequestError && error.code === "RESULT_NOT_READY") {
            setLoaded({ source: "api", study, result: null });
            return;
          }
          throw error;
        }
      } catch (error) {
        if (!active || isAbort(error)) return;
        setLoaded({ source: "missing", message: messageFromError(error) });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, attempt]);

  const snapshotId =
    loaded.source === "api" && loaded.result ? loaded.study.id : null;
  const snapshotName =
    loaded.source === "api" && loaded.result ? loaded.study.originalFileName : "";

  useEffect(() => {
    if (!snapshotId) {
      setSnapshot(null);
      setSnapshotState("idle");
      return;
    }

    const controller = new AbortController();
    setSnapshot(null);
    setSnapshotState("idle");

    void getStudyFile(snapshotId, controller.signal)
      .then((blob) => {
        setSnapshot(
          new File([blob], snapshotName || "study.dcm", { type: "application/dicom" }),
        );
        setSnapshotState("ready");
      })
      .catch((error) => {
        if (isAbort(error)) return;
        setSnapshot(null);
        setSnapshotState("missing");
      });

    return () => controller.abort();
  }, [snapshotId, snapshotName]);

  return {
    loaded,
    snapshot,
    snapshotState,
    retry: () => setAttempt((value) => value + 1),
  };
}
