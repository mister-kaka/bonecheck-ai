import { useState } from "react";
import styles from "../../styles/Home.module.css";

import { Badge } from "../../components/Badge";
import { Progress } from "../../components/Progress";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";

type ScreenState = "idle" | "uploading" | "processing" | "result" | "error";

function Home() {
  const [state, setState] = useState<ScreenState>("idle");

  // Временные кнопки для проверки состояний. УДАЛИТЬ перед сдачей!
  const goIdle = () => setState("idle");
  const goUploading = () => setState("uploading");
  const goProcessing = () => setState("processing");
  const goResult = () => setState("result");
  const goError = () => setState("error");

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1>Анализ исследования</h1>
        <p className={styles.subtitle}>
          Загрузите DICOM-исследование — сервис проверит качество укладки
        </p>
      </header>

      {/* Временная панель. УДАЛИТЬ перед сдачей. */}
      <div className={styles.devPanel}>
        <span className={styles.devLabel}>Dev:</span>
        <button onClick={goIdle}>idle</button>
        <button onClick={goUploading}>uploading</button>
        <button onClick={goProcessing}>processing</button>
        <button onClick={goResult}>result</button>
        <button onClick={goError}>error</button>
      </div>

      {/*  IDLE  */}
      {state === "idle" && (
        <div className={styles.centered}>
          <Card>
            <div className={styles.uploadBlock}>
              <div className={styles.uploadIcon}>⬆</div>
              <h2>Загрузите DICOM-исследование</h2>
              <p className={styles.hint}>Перетащите файл или папку сюда</p>

              <div className={styles.uploadActions}>
                <Button variant="secondary" iconLeft={<span>📁</span>}>
                  Выбрать файл
                </Button>
                <Button iconLeft={<span>📦</span>}>Загрузить ZIP</Button>
              </div>

              <p className={styles.formats}>
                Поддерживаемые форматы: .dcm, .zip
              </p>
            </div>
          </Card>
        </div>
      )}

      {/*  UPLOADING  */}
      {state === "uploading" && (
        <div className={styles.centered}>
          <Card>
            <div className={styles.uploadProgress}>
              <div className={styles.uploadHead}>
                <span className={styles.fileName}>📄 CR000000.dcm</span>
                <button className={styles.cancel}>✕ Отмена</button>
              </div>

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

      {/*  PROCESSING  */}
      {state === "processing" && (
        <div className={styles.centered}>
          <Card>
            <div className={styles.processing}>
              <Spinner label="Анализ исследования..." size="lg" />
              <p className={styles.region}>
                Определение региона: <strong>Проксимальный отдел бедра</strong>
              </p>
              <p className={styles.time}>Время: 12 сек</p>
            </div>
          </Card>
        </div>
      )}

      {/*  RESULT  */}
      {state === "result" && (
        <div className={styles.resultGrid}>
          <Card title="Исследование" subtitle="Снимок 1 из 1" padded={false}>
            <div className={styles.viewerPlaceholder}>
              <span>DICOM-ИЗОБРАЖЕНИЕ</span>
            </div>
          </Card>

          <Card
            title="Результат анализа"
            right={<Badge tone="success">Качественно</Badge>}
          >
            <div className={styles.resultHead}>
              <div className={styles.resultIconOk}>✓</div>
              <div>
                <h3>Исследование корректно</h3>
                <p className={styles.resultSub}>
                  Регион: Поясничный отдел позвоночника
                </p>
                <p className={styles.resultSub}>Уверенность: 91%</p>
              </div>
            </div>

            <div className={styles.resultActions}>
              <Button variant="secondary" iconLeft={<span>⤓</span>}>
                Экспорт XLSX
              </Button>
              <Button onClick={goIdle} iconLeft={<span>↻</span>}>
                Новое исследование
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/*  ERROR  */}
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