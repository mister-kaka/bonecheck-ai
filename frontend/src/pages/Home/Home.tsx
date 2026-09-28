import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Home.module.css";
import { UploadProgressBlock } from "../../components/Home/upload/UploadProgressBlock";
import { SelectedFileBlock } from "../../components/Home/upload/SelectedFileBlock";
import { AnalysisBlock } from "../../components/Home/status/AnalysisBlock";
import { Button } from "../../components/ui/Button";
import { ResultBlock } from "../../components/Home/result/ResultBlock";
import { HowItWorks } from "../../components/Home/status/HowItWorks";
import { ChecksList } from "../../components/Home/status/ChecksList";
import { ProcessStatus } from "../../components/Home/status/ProcessStatus";
import { ErrorBlock } from "../../components/Home/status/ErrorBlock";
import { PackageOutcome } from "../../components/Home/status/PackageOutcome";
import { PageIntro } from "../../components/layout/PageIntro";
import { Icon } from "../../components/ui/Icon";
import { mapStudyResult } from "../../api/mapStudyResult";
import { useXlsxDownload } from "../../api/useXlsxDownload";
import { useStudyFlow } from "./useStudyFlow";

function Home() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const flow = useStudyFlow();
  const xlsx = useXlsxDownload();
  const view = flow.view;

  const resetInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  const returnToUpload = () => {
    flow.reset();
    resetInput();
    setDragOver(false);
    xlsx.clearExportError();
  };

  const openHistory = (path: string) => {
    document.querySelector(".app-main")?.scrollTo({ top: 0 });
    navigate(path);
  };

  const acceptList = (list: FileList) => {
    const files = Array.from(list);
    setDragOver(false);
    resetInput();
    flow.acceptFileList(files);
  };

  const handleDcmChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    acceptList(files);
  };

  const handleZipChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setDragOver(false);
    resetInput();
    flow.acceptZip(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    acceptList(event.dataTransfer.files);
  };

  const showProcessStatus =
    view.kind === "uploading" || view.kind === "processing" || view.kind === "still-running";
  const processStage = view.kind === "uploading" ? "uploading" : "processing";
  const resultView = view.kind === "result" ? mapStudyResult(view.result) : null;

  return (
    <div className={styles.page} data-home-state={view.kind}>
      {view.kind !== "result" && (
        <header>
          <PageIntro
            kicker="Качество укладки"
            title="Проверка исследования"
            subtitle="Один DICOM или ZIP. Каждый снимок в архиве проверяется отдельно."
          />
        </header>
      )}

      <div className={showProcessStatus ? styles.layout : styles.layoutFull}>
        <div className={styles.mainColumn}>
          {view.kind === "idle" && (
            <>
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
                  <h2 id="upload-title">Загрузите DICOM или ZIP</h2>
                  <p className={styles.hint}>
                    Перетащите один файл сюда или выберите его на компьютере.
                  </p>

                  <div className={styles.uploadActions}>
                    <Button
                      variant="primary"
                      iconLeft={<Icon name="upload" size={16} />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Выбрать файл
                    </Button>
                    <Button
                      variant="secondary"
                      iconLeft={<Icon name="file" size={16} />}
                      onClick={() => zipInputRef.current?.click()}
                    >
                      Загрузить ZIP
                    </Button>
                  </div>

                  <p className={styles.formats}>Один файл .dcm / .dicom или один архив .zip. До 50 МБ.</p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dcm,.dicom,application/dicom,application/x-dicom"
                    hidden
                    aria-label="Выбрать DICOM-файл"
                    onChange={handleDcmChange}
                  />
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    hidden
                    aria-label="Загрузить ZIP"
                    onChange={handleZipChange}
                  />
                </div>
              </section>

              <div className={styles.infoRow}>
                <HowItWorks />
                <ChecksList />
              </div>
            </>
          )}

          {view.kind === "selected" && (
            <section className={styles.workPanel}>
              <SelectedFileBlock
                fileName={view.fileName}
                fileSize={view.sizeLabel}
                fileFormat={view.format}
                onStart={flow.start}
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
              <AnalysisBlock fileName={view.fileName} onCancel={returnToUpload} />
            </section>
          )}

          {view.kind === "still-running" && (
            <section className={styles.workPanel} aria-live="polite">
              <div className={styles.package}>
                <div>
                  <p className={styles.packageKicker}>Идёт проверка</p>
                  <h2 className={styles.packageTitle}>Анализ ещё выполняется</h2>
                  <p className={styles.packageLead}>
                    Проверка укладки ещё не закончилась, результат пока не создан. Можно
                    подождать здесь или открыть историю.
                  </p>
                  <p className={styles.packageName}>{view.fileName}</p>
                </div>
                <div className={styles.packageActions}>
                  <Button variant="primary" onClick={flow.continueWaiting}>
                    Продолжить ожидание
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      openHistory(
                        view.studyIds.length === 1
                          ? `/history/${view.studyIds[0]}`
                          : "/history",
                      );
                    }}
                  >
                    Открыть в истории
                  </Button>
                </div>
              </div>
            </section>
          )}

          {view.kind === "result" && resultView && (
            <ResultBlock
              files={view.file ? [view.file] : []}
              isOk={resultView.isOk}
              region={resultView.region}
              qualityProb={resultView.qualityProb}
              violations={resultView.violations}
              criteria={resultView.criteria}
              fileName={view.fileName}
              description={resultView.summary}
              emptyLabel={
                view.notice || "Снимок недоступен для просмотра."
              }
              exporting={xlsx.exporting}
              exportError={xlsx.exportError}
              onExport={() => {
                void xlsx.download({ ids: [view.studyId] });
              }}
              onOpenHistory={() => openHistory(`/history/${view.studyId}`)}
              onNewStudy={returnToUpload}
            />
          )}

          {view.kind === "package" && (
            <section className={styles.workPanel}>
              <PackageOutcome
                archiveName={view.archiveName}
                items={view.items}
                onOpenStudy={(id) => navigate(`/history/${id}`)}
                onOpenHistory={() => navigate("/history")}
                onNewStudy={returnToUpload}
              />
            </section>
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
              title="Проверка не выполнена"
              message={view.message}
              onRetry={returnToUpload}
            />
          )}
        </div>

        {showProcessStatus && (
          <div className={styles.sideColumn}>
            <ProcessStatus stage={processStage} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
