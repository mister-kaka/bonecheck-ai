import { useEffect, useRef, useState } from "react";
import {
  dicomRejection,
  FOLDER_MESSAGE,
  MULTIPLE_FILES_MESSAGE,
} from "../../api/fileRules";
import { MOCK_RESULT_OK } from "../../mocks/result";
import type { StudyResultPayload } from "../../types/study";

export type HomeView =
  | { kind: "idle" }
  | { kind: "selected"; fileName: string; sizeLabel: string; format: string }
  | { kind: "uploading"; fileName: string; sizeLabel: string; format: string; progress: number }
  | { kind: "processing"; fileName: string; progress: number }
  | { kind: "file-error"; message: string }
  | { kind: "analysis-error"; message: string }
  | {
      kind: "result";
      file: File | null;
      result: StudyResultPayload;
      notice: string;
    };

const UPLOAD_MS = 900;
const ANALYSIS_MS = 1400;

const LIVE_RESULT_NOTICE =
  "Сервер не подключён: POST /api/studies не вызывается. Показан фиксированный пример ответа mock ML, это не проверка выбранного файла. Снимок в просмотрщике - локально открытый DICOM.";

type Phase = "idle" | "selected" | "running" | "file-error" | "result";

type SelectedFile = {
  file: File;
  sizeLabel: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function useStudyFlow() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [runningKind, setRunningKind] = useState<"uploading" | "processing">("uploading");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<StudyResultPayload | null>(null);

  const generation = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const reset = () => {
    generation.current += 1;
    clearTimer();
    setSelected(null);
    setProgress(0);
    setErrorMessage("");
    setResult(null);
    setRunningKind("uploading");
    setPhase("idle");
  };

  const showFileError = (message: string) => {
    generation.current += 1;
    clearTimer();
    setSelected(null);
    setProgress(0);
    setResult(null);
    setErrorMessage(message);
    setPhase("file-error");
  };

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    const rejection = dicomRejection(file);
    if (rejection) {
      showFileError(rejection);
      return;
    }
    generation.current += 1;
    clearTimer();
    setSelected({ file, sizeLabel: formatFileSize(file.size) });
    setProgress(0);
    setErrorMessage("");
    setResult(null);
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
    acceptFile(list[0]);
  };

  const start = () => {
    if (!selected || phase !== "selected") return;
    const runId = generation.current + 1;
    generation.current = runId;
    clearTimer();
    setProgress(0);
    setRunningKind("uploading");
    setPhase("running");

    const started = performance.now();
    timerRef.current = window.setInterval(() => {
      if (generation.current !== runId) return;
      const elapsed = performance.now() - started;
      if (elapsed < UPLOAD_MS) {
        setRunningKind("uploading");
        setProgress(Math.min(100, Math.round((elapsed / UPLOAD_MS) * 100)));
        return;
      }
      const analysisElapsed = elapsed - UPLOAD_MS;
      if (analysisElapsed < ANALYSIS_MS) {
        setRunningKind("processing");
        setProgress(Math.min(100, Math.round((analysisElapsed / ANALYSIS_MS) * 100)));
        return;
      }
      clearTimer();
      setProgress(100);
      setResult(MOCK_RESULT_OK);
      setPhase("result");
    }, 50);
  };

  let view: HomeView;
  if (phase === "selected" && selected) {
    view = {
      kind: "selected",
      fileName: selected.file.name,
      sizeLabel: selected.sizeLabel,
      format: "DICOM",
    };
  } else if (phase === "running" && selected && runningKind === "uploading") {
    view = {
      kind: "uploading",
      fileName: selected.file.name,
      sizeLabel: selected.sizeLabel,
      format: "DICOM",
      progress,
    };
  } else if (phase === "running" && selected) {
    view = {
      kind: "processing",
      fileName: selected.file.name,
      progress,
    };
  } else if (phase === "file-error") {
    view = { kind: "file-error", message: errorMessage };
  } else if (phase === "result" && selected && result) {
    view = {
      kind: "result",
      file: selected.file,
      result,
      notice: LIVE_RESULT_NOTICE,
    };
  } else {
    view = { kind: "idle" };
  }

  return { view, acceptFileList, start, reset };
}
