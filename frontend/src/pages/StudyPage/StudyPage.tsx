import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ANALYSIS_ERROR_MESSAGE, RESULT_NOT_READY_MESSAGE } from "../../api/fileRules";
import { useXlsxDownload } from "../../api/useXlsxDownload";
import { PageIntro } from "../../components/layout/PageIntro";
import { Button } from "../../components/ui/Button";
import { ErrorBlock } from "../../components/Home/status/ErrorBlock";
import { ResultBlock } from "../../components/Home/result/ResultBlock";
import { StatusBadge } from "../../components/HistoryPage/StatusBadge";
import { mapStudyResult } from "../../api/mapStudyResult";
import { formatDate } from "../../history/formatDate";
import styles from "../HistoryPage/HistoryPage.module.css";
import { useStudyCard } from "./useStudyCard";

const FILE_MISSING = "Файл исследования не найден.";
const FILE_LOADING = "Загрузка снимка";

export function StudyPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const xlsx = useXlsxDownload();
  const { loaded, snapshot, snapshotState, retry } = useStudyCard(id, xlsx.clearExportError);

  useEffect(() => {
    document.querySelector(".app-main")?.scrollTo({ top: 0 });
  }, [id]);

  const back = () => {
    navigate({ pathname: "/history", search: location.search });
  };

  const apiStudy = loaded.source === "api" ? loaded.study : null;
  const resultView =
    loaded.source === "api" && loaded.result ? mapStudyResult(loaded.result) : null;
  const fileName = apiStudy?.originalFileName ?? "Исследование не найдено";
  const status = apiStudy?.status;
  const createdAt = apiStudy?.createdAt;
  const studyError = apiStudy?.error ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <PageIntro
          kicker="Карточка исследования"
          title={loaded.source === "loading" ? "Загрузка" : fileName}
          subtitle="Статус, результат проверки укладки и снимок."
        />
        <div className={styles.headerAside}>
          <Button variant="secondary" onClick={back}>
            К истории
          </Button>
        </div>
      </header>

      {loaded.source === "loading" && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Загрузка исследования</h2>
            <p className={styles.panelText}>Получаем статус исследования.</p>
          </div>
        </section>
      )}

      {loaded.source === "missing" && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Исследование недоступно</h2>
            <p className={styles.panelText}>{loaded.message}</p>
            <Button variant="secondary" size="sm" onClick={retry}>
              Повторить
            </Button>
          </div>
        </section>
      )}

      {status === "processing" && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <StatusBadge status="processing" />
            <h2 className={styles.panelTitle}>{RESULT_NOT_READY_MESSAGE}</h2>
            <p className={styles.panelText}>Статус обновляется с сервера.</p>
            {createdAt && (
              <p className={styles.meta}>
                {fileName} · {formatDate(createdAt)}
              </p>
            )}
          </div>
        </section>
      )}

      {status === "error" && (
        <ErrorBlock
          title="Проверка не выполнена"
          message={studyError ?? ANALYSIS_ERROR_MESSAGE}
          actionLabel="К загрузке"
          onRetry={() => navigate("/")}
        />
      )}

      {status === "uploaded" && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <StatusBadge status="uploaded" />
            <h2 className={styles.panelTitle}>Файл принят, проверка ещё не начата</h2>
            <p className={styles.meta}>{fileName}</p>
          </div>
        </section>
      )}

      {apiStudy &&
        !["uploaded", "processing", "completed", "error"].includes(status ?? "") && (
          <section className={styles.worklist}>
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>Неизвестный статус</h2>
              <p className={styles.panelText}>
                Статус исследования не распознан. Обновите страницу или вернитесь в историю.
              </p>
            </div>
          </section>
        )}

      {status === "completed" && !resultView && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Результат ещё не готов</h2>
            <p className={styles.panelText}>{RESULT_NOT_READY_MESSAGE}</p>
          </div>
        </section>
      )}

      {resultView && status === "completed" && apiStudy && (
        <ResultBlock
          files={snapshot ? [snapshot] : []}
          isOk={resultView.isOk}
          region={resultView.region}
          qualityProb={resultView.qualityProb}
          violations={resultView.violations}
          criteria={resultView.criteria}
          fileName={apiStudy.originalFileName}
          description={resultView.summary}
          emptyLabel={snapshotState === "missing" ? FILE_MISSING : FILE_LOADING}
          exporting={xlsx.exporting}
          exportError={xlsx.exportError}
          onExport={() => {
            void xlsx.download({ ids: [apiStudy.id] });
          }}
          onNewStudy={() => navigate("/")}
        />
      )}
    </div>
  );
}
