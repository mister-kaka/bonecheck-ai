import { useState, useEffect, useRef } from "react";
import styles from "../../styles/Home.module.css";

import { UploadProgressBlock } from "../../components/Home/UploadProgressBlock";
import { AnalysisBlock } from "../../components/Home/AnalysisBlock";
// import { Badge } from "../../components/Badge";
// import { Progress } from "../../components/Progress";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
// import { Spinner } from "../../components/Spinner";
import { ResultBlock } from "../../components/Home/ResultBlock";
import { HowItWorks } from "../../components/Home/HowItWorks";
import { ChecksList } from "../../components/Home/ChecksList";
import { ProcessStatus } from "../../components/Home/ProcessStatus";

type ScreenState = "idle" | "uploading" | "processing" | "result" | "error";

function Home() {
  // СОСТОЯНИЕ
  const [state, setState] = useState<ScreenState>("idle");

  //  ВРЕМЕННО: массив из 3 тестовых DICOM для проверки карусели. 
  // УДАЛИТЬ при интеграции — заменить на данные, пришедшие из API (массив URL/файлов одного study). 
  const [files, setFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // ВРЕМЕННО: кнопки для ручного переключения состояний во время разработки. 
  //  УДАЛИТЬ перед сдачей — состояния будут переключаться автоматически после ответов API.   
  const goIdle = () => setState("idle");
  const goUploading = () => setState("uploading");
  const goProcessing = () => setState("processing");
  const goResult = () => setState("result");
  const goError = () => setState("error");


  // ВРЕМЕННО: подгрузка 3 тестовых DICOM из /public.  
  // УДАЛИТЬ при интеграции с бэком. В реальном приложении файлы приходят через <input type="file"> или из API. 
  useEffect(() => {
    Promise.all([
      fetch("/test1.dcm").then((r) => r.blob()),
      fetch("/test2.dcm").then((r) => r.blob()),
      fetch("/test3.dcm").then((r) => r.blob()),
    ])
      .then((blobs) => {
        console.log("Загружено blob-ов:", blobs.length);
        const loaded = blobs.map(
          (b, i) =>
            new File([b], `test${i + 1}.dcm`, { type: "application/dicom" })
        );
        setFiles(loaded);
      })
      .catch((err) => console.error("Не удалось загрузить тестовые DICOM", err));
  }, []);


    // ВРЕМЕННО: скрытые input'ы для выбора файлов вручную
        // УДАЛИТЬ при интеграции — замени на реальный upload.
  const handlePickDcm = () => fileInputRef.current?.click();
  const handlePickZip = () => zipInputRef.current?.click();

  const handleDcmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFiles([file]);
    setState("result");
    e.target.value = "";
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("ZIP выбран:", file.name, file.size, "байт");
    setState("uploading");
    e.target.value = "";
  };

  // Показывать ли правую колонку «Статус процессов» — только на idle/uploading/processing
  const showProcessStatus =
    state === "uploading" || state === "processing";

  // RENDER
  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1>Анализ исследования</h1>
        <p className={styles.subtitle}>
          Загрузите DICOM-исследование — сервис проверит качество укладки
        </p>
      </header>

      {/* ВРЕМЕННО: dev-панель для переключения состояний вручную.
            УДАЛИТЬ перед сдачей.  */}
      <div className={styles.devPanel}>
        <span className={styles.devLabel}>Dev:</span>
        <button onClick={goIdle}>idle</button>
        <button onClick={goUploading}>uploading</button>
        <button onClick={goProcessing}>processing</button>
        <button onClick={goResult}>result</button>
        <button onClick={goError}>error</button>
      </div>

      {/* Layout: слева — основной контент, справа — «Статус процессов» */}
      <div className={showProcessStatus ? styles.layout : styles.layoutFull}>
        <div className={styles.mainColumn}>

          {/*  IDLE — пользователь ещё ничего не загрузил */}
          {state === "idle" && (
            <>
              <Card>
                <div className={styles.uploadBlock}>
                  <div className={styles.uploadIcon}>⬆</div>
                  <h2>Загрузите DICOM-исследование</h2>
                  <p className={styles.hint}>Перетащите файл или папку сюда</p>

                  <div className={styles.uploadActions}>
                    <Button
                      variant="secondary"
                      iconLeft={<img src="/icons/folder.png" alt="" width={18} height={18} />}
                      onClick={handlePickDcm}
                    >
                      Выбрать файл
                    </Button>
                    <Button
                      iconLeft={<img src="/icons/archive.png" alt="" width={18} height={18} />}
                      onClick={handlePickZip}
                    >
                      Загрузить ZIP
                    </Button>
                  </div>

                  <p className={styles.formats}>
                    Поддерживаемые форматы: .dcm, .zip
                  </p>

                  {/*  ВРЕМЕННО: скрытые input'ы для выбора файлов. 
                       УДАЛИТЬ при интеграции — заменю на реальный upload через API. */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dcm,application/dicom"
                    hidden
                    onChange={handleDcmChange}
                  />
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    hidden
                    onChange={handleZipChange}
                  />
                </div>
              </Card>

              {/* Информационные карточки под блоком загрузки */}
              <div className={styles.infoRow}>
                <HowItWorks />
                <ChecksList />
              </div>
            </>
          )}

          {/*  UPLOADING — идёт загрузка файла */}
          {state === "uploading" && (
            <Card>
              <UploadProgressBlock
                fileName="CR000000.dcm"
                fileSize="93 KB"
                fileFormat="DICOM CR"
                progress={67}
                onCancel={goIdle}
              />
            </Card>
          )}

          {/*  PROCESSING — идёт анализ */}
          {state === "processing" && (
            <Card>
              <AnalysisBlock
                region="Проксимальный отдел правого бедра"
                progress={42}
                onCancel={goIdle}
              />
            </Card>
          )}

          {/*  RESULT — результат анализа */}
          {state === "result" && (
            <ResultBlock
              // │ ВРЕМЕННО: files из тестового массива.    При интеграции — files из API-ответа                            
              files={files}
              // ⚠️ ВРЕМЕННО: isOk/region/confidence — хардкод. При интеграции — из ответа backend 
              // (quality_class, anatomical_region, quality_prob).
              // checks и summary по умолчанию — из ResultBlock (defaultChecks).
              // При интеграции — формировать из violation_type и description.
              isOk={true}
              region="Поясничный отдел позвоночника"
              confidence={0.91}
              onExport={() => console.log("export")} // ВРЕМЕННО: заглушка
              onNewStudy={goIdle}
            />
          )}

          {/*  ERROR — ошибка обработки  */}
          {state === "error" && (
            <Card>
              <div className={styles.errorBlock}>
                <div className={styles.errorIcon}>✕</div>
                <h3>Ошибка обработки</h3>
                <p className={styles.errorText}>
                  Не удалось обработать DICOM-файл. Причина: файл повреждён или
                  имеет неподдерживаемый формат.
                </p>
                <Button variant="secondary" onClick={goIdle}>
                  Загрузить другой файл
                </Button>
              </div>
            </Card>
          )}

        </div>

        {/* ПРАВАЯ КОЛОНКА — «Статус процессов» */}
        {showProcessStatus && (
          <aside className={styles.sideColumn}>
            <ProcessStatus stage={state} />
          </aside>
        )}
      </div>
    </div>
  );
}

export default Home;