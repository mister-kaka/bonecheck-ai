import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import styles from "../../styles/Home.module.css";
import { UploadProgressBlock } from "../../components/Home/UploadProgressBlock";
import { SelectedFileBlock } from "../../components/Home/SelectedFileBlock";
import { AnalysisBlock } from "../../components/Home/AnalysisBlock";
import { Button } from "../../components/Button";
import { ResultBlock } from "../../components/Home/ResultBlock";
import { HowItWorks } from "../../components/Home/HowItWorks";
import { ChecksList } from "../../components/Home/ChecksList";
import { ProcessStatus } from "../../components/Home/ProcessStatus";
import { ErrorBlock } from "../../components/Home/ErrorBlock";
import { Icon } from "../../components/Icon";
import { mapStudyResult } from "../../api/mapStudyResult";
import { DevStateSwitcher } from "../../dev/DevStateSwitcher";
import { previewHome, type DemoMode } from "../../dev/homePreview";
import { useStudyFlow, type HomeView } from "./useStudyFlow";

function Home() {
  const [demo, setDemo] = useState<DemoMode>("live");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useStudyFlow();
  const view: HomeView = demo === "live" ? flow.view : previewHome(demo);

  const resetInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const returnToUpload = () => {
    flow.reset();
    resetInput();
    setDragOver(false);
    setDemo("live");
  };

  const acceptList = (list: FileList) => {
    const files = Array.from(list);
    setDemo("live");
    setDragOver(false);
    resetInput();
    flow.acceptFileList(files);
  };

  const handleDcmChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    acceptList(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    acceptList(event.dataTransfer.files);
  };

  const startCheck = () => {
    if (demo === "live") {
      flow.start();
      return;
    }
    if (demo === "selected") setDemo("uploading");
  };

  const showProcessStatus = view.kind === "uploading" || view.kind === "processing";
  const resultView = view.kind === "result" ? mapStudyResult(view.result) : null;

  return (
    <div className={styles.page} data-home-state={view.kind}>
      {view.kind !== "result" && (
        <header className={styles.pageHead}>
          <p className={styles.kicker}>Одно исследование</p>
          <h1>Анализ исследования</h1>
          <p className={styles.subtitle}>
            Загрузите один DICOM-файл. Сервис оценит качество укладки, а не поставит диагноз
            и не измерит минеральную плотность кости.
          </p>
        </header>
      )}

      <div className={showProcessStatus ? styles.layout : styles.layoutFull}>
        <div className={styles.mainColumn}>
          {view.kind === "idle" && (
            <section className={styles.intake} aria-labelledby="upload-title">
              <div
                className={`${styles.drop} ${dragOver ? styles.dropActive : ""}`}
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
                <div className={styles.dropMark} aria-hidden="true">
                  <Icon name="file" size={22} />
                </div>
                <h2 id="upload-title">DICOM-исследование</h2>
                <p className={styles.hint}>Перетащите один файл сюда или выберите его на компьютере</p>

                <div className={styles.uploadActions}>
                  <Button
                    variant="primary"
                    iconLeft={<Icon name="upload" size={16} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Выбрать файл
                  </Button>
                </div>

                <ul className={styles.specs}>
                  <li>.dcm, .dicom</li>
                  <li>один файл</li>
                  <li>до 50 МБ</li>
                </ul>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dcm,.dicom,application/dicom,application/x-dicom"
                  hidden
                  aria-label="Выбрать DICOM-файл"
                  onChange={handleDcmChange}
                />
              </div>

              <div className={styles.intakeAside}>
                <HowItWorks />
                <ChecksList />
              </div>
            </section>
          )}

          {view.kind === "selected" && (
            <section className={styles.workPanel}>
              <SelectedFileBlock
                fileName={view.fileName}
                fileSize={view.sizeLabel}
                fileFormat={view.format}
                onStart={startCheck}
                onCancel={returnToUpload}
              />
            </section>
          )}

          {view.kind === "uploading" && (
            <section className={styles.workPanel}>
              <UploadProgressBlock
                fileName={view.fileName}
                fileSize={view.sizeLabel}
                fileFormat={view.format}
                progress={view.progress}
                onCancel={returnToUpload}
              />
            </section>
          )}

          {view.kind === "processing" && (
            <section className={styles.workPanel}>
              <AnalysisBlock
                progress={view.progress}
                fileName={view.fileName}
                onCancel={returnToUpload}
              />
            </section>
          )}

          {view.kind === "result" && resultView && (
            <div className={styles.resultStack}>
              <p className={styles.demoNote}>{view.notice}</p>
              <ResultBlock
                files={view.file ? [view.file] : []}
                isOk={resultView.isOk}
                region={resultView.region}
                qualityProb={resultView.qualityProb}
                violations={resultView.violations}
                description={resultView.summary}
                emptyLabel="Снимок не приложен к демонстрационному результату."
                onNewStudy={returnToUpload}
              />
            </div>
          )}

          {view.kind === "file-error" && (
            <ErrorBlock
              title="Файл не принят"
              message={view.message}
              onRetry={returnToUpload}
            />
          )}

          {view.kind === "analysis-error" && (
            <ErrorBlock
              title="Анализ не выполнен"
              message={view.message}
              onRetry={returnToUpload}
            />
          )}
        </div>

        {showProcessStatus && (
          <div className={styles.sideColumn}>
            <ProcessStatus stage={view.kind} />
          </div>
        )}
      </div>

      <DevStateSwitcher value={demo} onChange={setDemo} />
    </div>
  );
}

export default Home;
