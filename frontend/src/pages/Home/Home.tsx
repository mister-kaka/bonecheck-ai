import { useState, useEffect, useRef } from "react";
import styles from "../../styles/Home.module.css";

// import { Badge } from "../../components/Badge";
import { Progress } from "../../components/Progress";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { ResultBlock } from "../../components/Home/ResultBlock";

type ScreenState = "idle" | "uploading" | "processing" | "result" | "error";

function Home() {
  // СОСТОЯНИЕ
  const [state, setState] = useState<ScreenState>("idle");

 // ВРЕМЕННО: для отладки вручную
 //   УДАЛИТЬ при интеграции  с API — testFile будет приходить из реального upload'а. 
  const [testFile, setTestFile] = useState<File | null>(null);

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
        setTestFile(loaded[0] ?? null);
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
    setTestFile(file);
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

      {/*  IDLE — пользователь ещё ничего не загрузил */}
      {state === "idle" && (
        <div className={styles.centered}>
          <Card>
            <div className={styles.uploadBlock}>
              <div className={styles.uploadIcon}>⬆</div>
              <h2>Загрузите DICOM-исследование</h2>
              <p className={styles.hint}>Перетащите файл или папку сюда</p>

              <div className={styles.uploadActions}>
                <Button
                  variant="secondary"
                  iconLeft={<span>📁</span>}
                  onClick={handlePickDcm}
                >
                  Выбрать файл
                </Button>
                <Button
                  iconLeft={<span>📦</span>}
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
        </div>
      )}

      {/*  UPLOADING — идёт загрузка файла */}
      {state === "uploading" && (
        <div className={styles.centered}>
          <Card>
            <div className={styles.uploadProgress}>
              <div className={styles.uploadHead}>
                <span className={styles.fileName}>📄 CR000000.dcm</span>
                <button className={styles.cancel}>✕ Отмена</button>
              </div>

              {/* ⚠️ ВРЕМЕННО: Progress с value={67} — хардкод. При интеграции с API — реальный прогресс загрузки. */}
              <Progress value={67} />

              <div className={styles.uploadMeta}>
                <span>Размер: 83 КБ</span>
                <span>Формат: DICOM CR</span>
                <span className={styles.percent}>67%</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/*  PROCESSING — идёт анализ */}
      {state === "processing" && (
        <div className={styles.centered}>
          <Card>
            <div className={styles.processing}>
              <Spinner label="Анализ исследования..." size="lg" />

              {/*  ВРЕМЕННО: регион и время — хардкод. При интеграции — приходит от backend. */}
              <p className={styles.region}>
                Определение региона: <strong>Проксимальный отдел бедра</strong>
              </p>
              <p className={styles.time}>Время: 12 сек</p>
            </div>
          </Card>
        </div>
      )}

      {/*  RESULT — результат анализа */}
      {state === "result" && (
        <ResultBlock
          // │ ВРЕМЕННО: files из тестового массива.    При интеграции — files из API-ответа                            
          files={files}
          // ⚠️ ВРЕМЕННО: isOk/region/confidence/violations/description — хардкод. При интеграции — из ответа backend 
          // (quality_class, anatomical_region, quality_prob, violation_type, description).
          isOk={true}
          region="Поясничный отдел позвоночника"
          confidence={0.91}
          violations={[]}
          description="Исследование выполнено корректно. Укладка соответствует стандарту, ось позвоночника выровнена."
          onExport={() => console.log("export")} // ВРЕМЕННО: заглушка
          onNewStudy={goIdle}
        />
      )}

      {/*  ERROR — ошибка обработки  */}
      {state === "error" && (
        <div className={styles.centered}>
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
        </div>
      )}
    </div>
  );
}

export default Home;