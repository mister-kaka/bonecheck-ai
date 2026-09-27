import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import styles from "../../styles/Home.module.css";

import { UploadProgressBlock } from "../../components/Home/UploadProgressBlock";
import { AnalysisBlock } from "../../components/Home/AnalysisBlock";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { ResultBlock } from "../../components/Home/ResultBlock";
import { HowItWorks } from "../../components/Home/HowItWorks";
import { ChecksList } from "../../components/Home/ChecksList";
import { ProcessStatus } from "../../components/Home/ProcessStatus";
import { ErrorBlock } from "../../components/Home/ErrorBlock";
import { mapStudyResult, type ApiStudyResult } from "../../api/mapStudyResult";

type ScreenState = "idle" | "uploading" | "processing" | "result" | "error";

type SelectedFile = {
  file: File;
  sizeLabel: string;
};

/** Лимит Multer, docs/api.md: 50 МБ. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_MS = 900;
const ANALYSIS_MS = 1400;

/**
 * Типичный ответ MockMlClient (docs/api.md).
 * При интеграции заменить на GET /api/studies/:id/result после polling статуса.
 */
const MOCK_COMPLETED_RESULT: ApiStudyResult = {
  studyId: "mock",
  quality_class: 0,
  violation_type: "",
  quality_prob: 0.05,
  anatomical_region: "Поясничный отдел позвоночника",
};

function isDicomFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".dcm") || name.endsWith(".dicom")) return true;
  return file.type === "application/dicom" || file.type === "application/x-dicom";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function Home() {
  const [state, setState] = useState<ScreenState>("idle");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const resetInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetToIdle = () => {
    generation.current += 1;
    clearTimer();
    resetInput();
    setSelected(null);
    setProgress(0);
    setErrorMessage("");
    setDragOver(false);
    setState("idle");
  };

  const showError = (message: string) => {
    generation.current += 1;
    clearTimer();
    resetInput();
    setSelected(null);
    setProgress(0);
    setDragOver(false);
    setErrorMessage(message);
    setState("error");
  };

  const beginMockRun = (file: File) => {
    const runId = generation.current + 1;
    generation.current = runId;
    clearTimer();
    resetInput();
    setSelected({ file, sizeLabel: formatFileSize(file.size) });
    setErrorMessage("");
    setDragOver(false);
    setProgress(0);
    setState("uploading");

    const started = performance.now();
    timerRef.current = window.setInterval(() => {
      if (generation.current !== runId) return;
      const elapsed = performance.now() - started;
      if (elapsed < UPLOAD_MS) {
        setState("uploading");
        setProgress(Math.min(100, Math.round((elapsed / UPLOAD_MS) * 100)));
        return;
      }
      const analysisElapsed = elapsed - UPLOAD_MS;
      if (analysisElapsed < ANALYSIS_MS) {
        setState("processing");
        setProgress(Math.min(100, Math.round((analysisElapsed / ANALYSIS_MS) * 100)));
        return;
      }
      clearTimer();
      setProgress(100);
      setState("result");
    }, 50);
  };

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size === 0) {
      showError("Файл пустой. Выберите DICOM-исследование.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showError("Файл больше 50 МБ. Можно загрузить один DICOM не больше этого размера.");
      return;
    }
    if (!isDicomFile(file)) {
      showError("Нужен один файл DICOM с расширением .dcm или .dicom.");
      return;
    }
    beginMockRun(file);
  };

  const handleDcmChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const list = event.dataTransfer.files;
    if (list.length === 0) {
      showError("Папка не поддерживается. Выберите один DICOM-файл.");
      return;
    }
    if (list.length > 1) {
      showError("Можно загрузить только один DICOM-файл.");
      return;
    }
    acceptFile(list[0]);
  };

  const showProcessStatus = state === "uploading" || state === "processing";
  const resultView = mapStudyResult(MOCK_COMPLETED_RESULT);

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1>Анализ исследования</h1>
        <p className={styles.subtitle}>
          Загрузите один DICOM-файл. Сервис оценит качество укладки, а не поставит диагноз
          и не измерит минеральную плотность кости.
        </p>
      </header>

      <div className={showProcessStatus ? styles.layout : styles.layoutFull}>
        <div className={styles.mainColumn}>
          {state === "idle" && (
            <>
              <Card highlighted={dragOver}>
                <div
                  className={styles.uploadBlock}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    const next = event.relatedTarget;
                    if (next instanceof Node && event.currentTarget.contains(next)) return;
                    setDragOver(false);
                  }}
                  onDrop={handleDrop}
                >
                  <div className={styles.uploadIcon} aria-hidden="true">
                    ⬆
                  </div>
                  <h2 id="upload-title">Загрузите DICOM-исследование</h2>
                  <p className={styles.hint}>Перетащите один файл сюда или выберите его на компьютере</p>

                  <div className={styles.uploadActions}>
                    <Button
                      variant="secondary"
                      iconLeft={<img src="/icons/folder.png" alt="" width={18} height={18} />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Выбрать файл
                    </Button>
                  </div>

                  <p className={styles.formats}>Поддерживается один файл: .dcm, .dicom. До 50 МБ.</p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dcm,.dicom,application/dicom,application/x-dicom"
                    hidden
                    aria-label="Выбрать DICOM-файл"
                    onChange={handleDcmChange}
                  />
                </div>
              </Card>

              <div className={styles.infoRow}>
                <HowItWorks />
                <ChecksList />
              </div>
            </>
          )}

          {state === "uploading" && selected && (
            <Card>
              <UploadProgressBlock
                fileName={selected.file.name}
                fileSize={selected.sizeLabel}
                fileFormat="DICOM"
                progress={progress}
                onCancel={resetToIdle}
              />
            </Card>
          )}

          {state === "processing" && (
            <Card>
              <AnalysisBlock progress={progress} onCancel={resetToIdle} />
            </Card>
          )}

          {state === "result" && selected && (
            <ResultBlock
              files={[selected.file]}
              isOk={resultView.isOk}
              region={resultView.region}
              qualityProb={resultView.qualityProb}
              violations={resultView.violations}
              description={resultView.summary}
              onNewStudy={resetToIdle}
            />
          )}

          {state === "error" && (
            <ErrorBlock
              title="Файл не принят"
              message={errorMessage}
              onRetry={resetToIdle}
            />
          )}
        </div>

        {showProcessStatus && (
          <div className={styles.sideColumn}>
            <ProcessStatus stage={state} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
