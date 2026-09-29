import { useEffect, useState } from "react";
import {
  ApiRequestError,
  getStudy,
  getStudyResult,
  listStudies,
  messageFromError,
} from "../../api/client";
import { getOrCreateSessionId } from "../../api/session";
import { isAbort } from "../../api/wait";
import type { HistoryRecord, HistoryScope } from "../../history/queryHistory";
import type { StudyListItem, StudyResultPayload } from "../../types/study";

const HISTORY_POLL_MS = 1000;
const RESULT_FETCH_LIMIT = 4;

export type HistoryLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: HistoryRecord[] };

async function toHistoryRecord(
  study: StudyListItem,
  signal: AbortSignal,
): Promise<HistoryRecord> {
  if (study.status !== "completed" || !study.hasResult) {
    return { study, result: null };
  }
  try {
    const result: StudyResultPayload = await getStudyResult(study.id, signal);
    return { study, result };
  } catch (error) {
    if (isAbort(error)) throw error;
    return { study, result: null };
  }
}

export function useHistoryCatalog(scope: HistoryScope) {
  const sessionId = getOrCreateSessionId();
  const [reloadKey, setReloadKey] = useState(0);
  const [load, setLoad] = useState<HistoryLoad>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoad({ status: "loading" });

    void (async () => {
      try {
        const response = await listStudiesRetrying(
          scope === "mine" ? sessionId : undefined,
          controller.signal,
        );
        const items = await mapWithLimit(response.items, RESULT_FETCH_LIMIT, (study) =>
          toHistoryRecord(study, controller.signal),
        );
        if (active) setLoad({ status: "ready", items });
      } catch (error) {
        if (!active || isAbort(error)) return;
        setLoad({ status: "error", message: messageFromError(error) });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [scope, sessionId, reloadKey]);

  useEffect(() => {
    if (load.status !== "ready") return;
    const processingIds = load.items
      .filter((item) => item.study.status === "processing")
      .map((item) => item.study.id);
    if (processingIds.length === 0) return;

    const controller = new AbortController();
    let active = true;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const settled = await mapWithLimit(processingIds, RESULT_FETCH_LIMIT, async (id) => {
            try {
              return { id, study: await getStudy(id, controller.signal) };
            } catch (error) {
              if (isAbort(error)) throw error;
              if (error instanceof ApiRequestError && (error.statusCode === 404 || error.statusCode === 400)) {
                return { id, study: null };
              }
              throw error;
            }
          });
        if (!active) return;

        const missingIds = new Set(
          settled.filter((item) => item.study === null).map((item) => item.id),
        );
        const changed = settled.flatMap((item) =>
          item.study && item.study.status !== "processing" ? [item.study] : [],
        );
        if (missingIds.size === 0 && changed.length === 0) return;

        const resolved = await mapWithLimit(changed, RESULT_FETCH_LIMIT, (study) =>
          toHistoryRecord(study, controller.signal),
        );
        if (!active) return;

        setLoad((current) => {
          if (current.status !== "ready") return current;
          const byId = new Map(resolved.map((item) => [item.study.id, item]));
          return {
            status: "ready",
            items: current.items.map((item) => {
              const next = byId.get(item.study.id);
              if (next) return next;
              if (!missingIds.has(item.study.id)) return item;
              return {
                study: {
                  ...item.study,
                  status: "error",
                  error: "Исследование не найдено.",
                  hasResult: false,
                },
                result: null,
              };
            }),
          };
        });
      } catch (error) {
        if (!active || isAbort(error)) return;
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, HISTORY_POLL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  return {
    load,
    sessionId,
    reload: () => setReloadKey((value) => value + 1),
  };
}

async function listStudiesRetrying(sessionId: string | undefined, signal: AbortSignal) {
  try {
    return await listStudies(sessionId, signal);
  } catch (error) {
    if (isAbort(error) || signal.aborted) throw error;
    const retryable =
      error instanceof ApiRequestError &&
      (error.code === "TIMEOUT" || error.code === "NETWORK");
    if (!retryable) throw error;
    return listStudies(sessionId, signal);
  }
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  mapItem: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapItem(items[index]);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
