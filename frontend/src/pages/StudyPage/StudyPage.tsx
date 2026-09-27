import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/Button";
import { ErrorBlock } from "../../components/Home/ErrorBlock";
import { ResultBlock } from "../../components/Home/ResultBlock";
import { StatusBadge } from "../../components/HistoryPage/StatusBadge";
import { getOrCreateSessionId } from "../../api/session";
import { mapStudyResult } from "../../api/mapStudyResult";
import { RESULT_NOT_READY_MESSAGE } from "../../api/fileRules";
import { formatDate } from "../../history/formatDate";
import { findDemoStudy } from "../../mocks/history";
import styles from "../../styles/HistoryPage.module.css";

const FILE_UNAVAILABLE =
  "Файл снимка не приходит в ответе API. Просмотр доступен для DICOM, выбранного на экране анализа.";

export function StudyPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = getOrCreateSessionId();
  const record = useMemo(() => findDemoStudy(sessionId, id), [sessionId, id]);

  const back = () => {
    navigate({ pathname: "/history", search: location.search });
  };

  const resultView = record?.result ? mapStudyResult(record.result) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.kicker}>Карточка исследования</p>
          <h1 className={styles.title}>
            {record?.study.originalFileName ?? "Исследование не найдено"}
          </h1>
          <p className={styles.subtitle}>
            Локальный пример записи. Сервер не запрашивался.
          </p>
        </div>
        <div className={styles.headerAside}>
          <Button variant="secondary" onClick={back}>
            К истории
          </Button>
        </div>
      </header>

      {!record && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Исследование не найдено</h2>
            <p className={styles.panelText}>
              В демонстрационном списке нет записи с этим идентификатором.
            </p>
          </div>
        </section>
      )}

      {record && record.study.status === "processing" && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <StatusBadge status={record.study.status} qualityClass={null} />
            <h2 className={styles.panelTitle}>{RESULT_NOT_READY_MESSAGE}</h2>
            <p className={styles.meta}>
              {record.study.originalFileName} · {formatDate(record.study.createdAt)}
            </p>
          </div>
        </section>
      )}

      {record && record.study.status === "error" && (
        <ErrorBlock
          title="Анализ не выполнен"
          message={record.study.error ?? "Ошибка обработки ML."}
          onRetry={() => navigate("/")}
        />
      )}

      {record && record.study.status === "uploaded" && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <StatusBadge status="uploaded" qualityClass={null} />
            <h2 className={styles.panelTitle}>Файл принят, анализ ещё не начат</h2>
            <p className={styles.meta}>{record.study.originalFileName}</p>
          </div>
        </section>
      )}

      {record && record.study.status === "completed" && !resultView && (
        <section className={styles.worklist}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Результат ещё не готов</h2>
            <p className={styles.panelText}>{RESULT_NOT_READY_MESSAGE}</p>
          </div>
        </section>
      )}

      {record && resultView && (
        <ResultBlock
          isOk={resultView.isOk}
          region={resultView.region}
          qualityProb={resultView.qualityProb}
          violations={resultView.violations}
          description={resultView.summary}
          emptyLabel={FILE_UNAVAILABLE}
          onNewStudy={() => navigate("/")}
        />
      )}
    </div>
  );
}
