import { useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  createStudy,
  createStudyPackage,
  getStudy,
  getStudyFile,
  getStudyResult,
  messageFromError,
} from "../../api/client";
import {
  ANALYSIS_ERROR_MESSAGE,
  dicomRejection,
  FOLDER_MESSAGE,
  MULTIPLE_FILES_MESSAGE,
  zipRejection,
  isZipFile,
} from "../../api/fileRules";
import { isAbort, wait } from "../../api/wait";
import type { PackageStudyItem, StudyListItem, StudyResultPayload } from "../../types/study";

export type HomeView =
  | { kind: "idle" }
  | { kind: "selected"; fileName: string; sizeLabel: string; format: string }
  | { kind: "uploading"; fileName: string; sizeLabel: string; format: string; progress: number }
  | { kind: "processing"; fileName: string }
  | { kind: "still-running"; fileName: string; studyIds: string[] }
  | { kind: "file-error"; message: string }
  | { kind: "analysis-error"; message: string }
  | {
      kind: "result";
      file: File | null;
      fileName: string;
      result: StudyResultPayload;
      notice: string;
      studyId: string;
    }
  | { kind: "package"; archiveName: string; items: PackageStudyItem[] };

type Phase =
  | "idle"
  | "selected"
  | "running"
  | "still-running"
  | "file-error"
  | "analysis-error"
  | "result"
  | "package";

type SelectedKind = "dicom" | "zip";

type SelectedFile = {
  file: File;
  sizeLabel: string;
  kind: SelectedKind;
};

const FILE_ERROR_CODES = new Set([
  "FILE_REQUIRED",
  "INVALID_FILE_TYPE",
  "FILE_TOO_LARGE",
  "INVALID_FILE",
  "INVALID_ZIP",
  "ZIP_EMPTY",
  "ZIP_NO_DICOM",
  "ZIP_UNSUPPORTED_FILE",
  "ZIP_PATH_TRAVERSAL",
  "ZIP_DUPLICATE",
  "ZIP_TOO_MANY_FILES",
]);

const ZIP_VIEWER_NOTICE =
  "Снимок сохранён на сервере, но не удалось открыть его в просмотрщике.";

const POLL_INTERVAL_MS = 1000;
/** Анализ одного файла по ТЗ может занимать до 3 минут. Запас покрывает задержку ответа. */
const POLL_TIMEOUT_MS = 3 * 60 * 1000 + 15_000;

async function fileFromStudy(study: StudyListItem, signal: AbortSignal): Promise<File | null> {
  try {
    const blob = await getStudyFile(study.id, signal);
    return new File([blob], study.originalFileName || "study.dcm", {
      type: blob.type || "application/dicom",
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

async function pollStudy(
  id: string,
  signal: AbortSignal,
): Promise<{ study: StudyListItem; pending: boolean }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let study = await getStudy(id, signal);
  while (study.status === "processing" && Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS, signal);
    study = await getStudy(id, signal);
  }
  return { study, pending: study.status === "processing" };
}

export function useStudyFlow() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [runningKind, setRunningKind] = useState<"uploading" | "processing">("uploading");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<StudyResultPayload | null>(null);
  const [studyId, setStudyId] = useState<string | undefined>(undefined);
  const [resultNotice, setResultNotice] = useState("");
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [resultFileName, setResultFileName] = useState("");
  const [packageItems, setPackageItems] = useState<PackageStudyItem[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pendingIdsRef = useRef<string[]>([]);
  const viewerRef = useRef<{ file: File | null; notice: string }>({ file: null, notice: "" });

  useEffect(() => {
    return () => {
      generation.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  const stopRun = () => {
    generation.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const reset = () => {
    stopRun();
    setSelected(null);
    setUploadProgress(0);
    setErrorMessage("");
    setResult(null);
    setStudyId(undefined);
    setResultNotice("");
    setResultFile(null);
    setResultFileName("");
    setPackageItems([]);
    pendingIdsRef.current = [];
    setPendingIds([]);
    viewerRef.current = { file: null, notice: "" };
    setRunningKind("uploading");
    setPhase("idle");
  };

  const showFileError = (message: string) => {
    stopRun();
    setSelected(null);
    setUploadProgress(0);
    setResult(null);
    setStudyId(undefined);
    setResultFileName("");
    setPackageItems([]);
    pendingIdsRef.current = [];
    setPendingIds([]);
    setErrorMessage(message);
    setPhase("file-error");
  };

  const showAnalysisError = (message: string) => {
    stopRun();
    setUploadProgress(0);
    setResult(null);
    setStudyId(undefined);
    setResultFileName("");
    pendingIdsRef.current = [];
    setPendingIds([]);
    setErrorMessage(message);
    setPhase("analysis-error");
  };

  const acceptSelected = (file: File, kind: SelectedKind) => {
    const rejection = kind === "zip" ? zipRejection(file) : dicomRejection(file);
    if (rejection) {
      showFileError(rejection);
      return;
    }
    stopRun();
    setSelected({ file, sizeLabel: formatFileSize(file.size), kind });
    setUploadProgress(0);
    setErrorMessage("");
    setResult(null);
    setStudyId(undefined);
    setResultNotice("");
    setResultFile(null);
    setResultFileName("");
    setPackageItems([]);
    setPhase("selected");
  };

  const acceptFileList = (list: FileList | File[]) => {
    if (list.length === 0) {
      showFileError(FOLDER_MESSAGE);
      return;
    }
    if (list.length > 1) {
      showFileError(MULTIPLE_FILES_MESSAGE);
      return;
    }
    const file = list[0];
    acceptSelected(file, isZipFile(file) ? "zip" : "dicom");
  };

  const acceptZip = (file: File | undefined) => {
    if (!file) return;
    acceptSelected(file, "zip");
  };

  const finishSingle = async (
    study: StudyListItem,
    file: File | null,
    notice: string,
    runId: number,
    signal: AbortSignal,
  ) => {
    if (study.status === "error") {
      if (generation.current !== runId) return;
      showAnalysisError(study.error ?? ANALYSIS_ERROR_MESSAGE);
      return;
    }

    const payload = await getStudyResult(study.id, signal);
    const viewerFile = file ?? (await fileFromStudy(study, signal));
    if (generation.current !== runId) return;
    setResult(payload);
    setStudyId(study.id);
    setResultFile(viewerFile);
    setResultFileName(study.originalFileName);
    setResultNotice(viewerFile ? "" : notice);
    setPhase("result");
  };

  const toPackageItem = async (
    study: StudyListItem,
    signal: AbortSignal,
  ): Promise<PackageStudyItem> => {
    let layoutLabel: string | null = null;
    if (study.status === "completed" && study.hasResult) {
      try {
        const payload = await getStudyResult(study.id, signal);
        layoutLabel =
          payload.quality_class === 1 ? "Нарушение качества укладки" : "Без нарушений";
      } catch (error) {
        if (isAbort(error)) throw error;
      }
    }
    return {
      id: study.id,
      fileName: study.originalFileName,
      status: study.status,
      error: study.error,
      layoutLabel,
    };
  };

  const failRun = (error: unknown, runId: number) => {
    if (generation.current !== runId || isAbort(error)) return;
    const message = messageFromError(error);
    const code = error instanceof ApiRequestError ? error.code : undefined;
    if (code && FILE_ERROR_CODES.has(code)) {
      showFileError(message);
      return;
    }
    showAnalysisError(message);
  };

  const rememberPending = (ids: string[]) => {
    pendingIdsRef.current = ids;
    setPendingIds(ids);
  };

  const settleStudies = async (ids: string[], runId: number, signal: AbortSignal) => {
    const polled = await Promise.all(ids.map((id) => pollStudy(id, signal)));
    if (generation.current !== runId) return;

    if (polled.some((item) => item.pending)) {
      rememberPending(polled.map((item) => item.study.id));
      setPhase("still-running");
      return;
    }

    const finished = polled.map((item) => item.study);
    rememberPending([]);
    if (finished.length === 1) {
      await finishSingle(
        finished[0],
        viewerRef.current.file,
        viewerRef.current.notice,
        runId,
        signal,
      );
      return;
    }

    setPackageItems(
      await Promise.all(finished.map((study) => toPackageItem(study, signal))),
    );
    if (generation.current !== runId) return;
    setPhase("package");
  };

  const beginRun = () => {
    const runId = generation.current + 1;
    generation.current = runId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return { runId, signal: controller.signal };
  };

  const start = () => {
    if (!selected || phase !== "selected") return;
    const current = selected;
    const { runId, signal } = beginRun();
    setUploadProgress(0);
    setRunningKind("uploading");
    setPhase("running");
    viewerRef.current = {
      file: current.kind === "dicom" ? current.file : null,
      notice: current.kind === "zip" ? ZIP_VIEWER_NOTICE : "",
    };

    const onUploadProgress = (ratio: number) => {
      if (generation.current !== runId) return;
      setUploadProgress(Math.round(ratio * 100));
    };

    void (async () => {
      try {
        const createdIds =
          current.kind === "zip"
            ? (
                await createStudyPackage(current.file, signal, onUploadProgress)
              ).items.map((item) => item.id)
            : [(await createStudy(current.file, signal, onUploadProgress)).id];
        if (generation.current !== runId) return;
        setRunningKind("processing");
        await settleStudies(createdIds, runId, signal);
      } catch (error) {
        failRun(error, runId);
      }
    })();
  };

  const continueWaiting = () => {
    if (phase !== "still-running") return;
    const ids = pendingIdsRef.current;
    if (ids.length === 0) return;
    const { runId, signal } = beginRun();
    setRunningKind("processing");
    setPhase("running");

    void (async () => {
      try {
        await settleStudies(ids, runId, signal);
      } catch (error) {
        failRun(error, runId);
      }
    })();
  };

  let view: HomeView;
  if (phase === "selected" && selected) {
    view = {
      kind: "selected",
      fileName: selected.file.name,
      sizeLabel: selected.sizeLabel,
      format: selected.kind === "zip" ? "ZIP" : "DICOM",
    };
  } else if (phase === "running" && selected && runningKind === "uploading") {
    view = {
      kind: "uploading",
      fileName: selected.file.name,
      sizeLabel: selected.sizeLabel,
      format: selected.kind === "zip" ? "ZIP" : "DICOM",
      progress: uploadProgress,
    };
  } else if (phase === "running" && selected) {
    view = {
      kind: "processing",
      fileName: selected.file.name,
    };
  } else if (phase === "still-running" && selected) {
    view = {
      kind: "still-running",
      fileName: selected.file.name,
      studyIds: pendingIds,
    };
  } else if (phase === "file-error") {
    view = { kind: "file-error", message: errorMessage };
  } else if (phase === "analysis-error") {
    view = { kind: "analysis-error", message: errorMessage };
  } else if (phase === "result" && result && studyId) {
    view = {
      kind: "result",
      file: resultFile,
      fileName: resultFileName,
      result,
      notice: resultNotice,
      studyId,
    };
  } else if (phase === "package" && selected) {
    view = {
      kind: "package",
      archiveName: selected.file.name,
      items: packageItems,
    };
  } else {
    view = { kind: "idle" };
  }

  return { view, acceptFileList, acceptZip, start, continueWaiting, reset };
}
