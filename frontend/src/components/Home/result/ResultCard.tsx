import type { CriterionRow } from "../../../api/layoutCriteria";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { CheckDetail } from "./CheckDetail";
import styles from "./ResultCard.module.css";

interface ResultCardProps {
  isOk: boolean;
  region: string;
  qualityProb?: number;
  violations?: string[];
  criteria?: CriterionRow[];
  fileName?: string;
  description?: string;
  onExport?: () => void;
  onDownloadSubmission?: () => void;
  onOpenHistory?: () => void;
  onNewStudy?: () => void;
  exporting?: boolean;
  exportError?: string;
}

export function ResultCard({
  isOk,
  region,
  qualityProb,
  violations = [],
  criteria = [],
  fileName,
  description,
  onExport,
  onDownloadSubmission,
  onOpenHistory,
  onNewStudy,
  exporting = false,
  exportError,
}: ResultCardProps) {
  const percent =
    qualityProb === undefined
      ? undefined
      : Math.round(Math.min(1, Math.max(0, qualityProb)) * 100);

  return (
    <section
      className={`${styles.resultCard} ${isOk ? styles.ok : styles.warn}`}
      aria-label="Результат проверки укладки"
    >
      <header className={styles.head}>
        <h2 className={styles.title}>
          {isOk ? "Укладка корректна" : "Нарушение качества укладки"}
        </h2>
        {isOk ? (
          <Badge tone="success">Без нарушений</Badge>
        ) : (
          <Badge tone="warning">Нарушение</Badge>
        )}
        {fileName && <p className={styles.fileName}>{fileName}</p>}
      </header>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Анатомическая область</dt>
          <dd>{region}</dd>
        </div>
        {percent !== undefined && (
          <div className={styles.factProb}>
            <div className={styles.fact}>
              <dt>Вероятность нарушения</dt>
              <dd className={styles.prob}>
                <span className={styles.probValue}>{percent}%</span>
              </dd>
            </div>
            <p className={styles.probNote}>
              Это вероятность нарушения качества укладки, а не уверенность диагноза.
            </p>
          </div>
        )}
      </dl>

      {violations.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Обнаруженные нарушения</h3>
          <ul className={styles.violations}>
            {violations.map((violation) => (
              <li key={violation}>{violation}</li>
            ))}
          </ul>
        </div>
      )}

      {criteria.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Критерии области</h3>
          <div className={styles.checks}>
            {criteria.map((criterion, index) => (
              <CheckDetail
                key={criterion.title}
                index={index + 1}
                title={criterion.title}
                status={criterion.found ? "Нарушение" : "Без нарушений"}
                tone={criterion.found ? "warning" : "success"}
              />
            ))}
          </div>
        </div>
      )}

      {description && <p className={styles.description}>{description}</p>}

      <div className={styles.actions}>
        {onExport && (
          <Button variant="secondary" onClick={onExport} disabled={exporting}>
            {exporting ? "Выгрузка..." : "Экспорт истории"}
          </Button>
        )}
        {onDownloadSubmission && (
          <Button variant="secondary" onClick={onDownloadSubmission} disabled={exporting}>
            {exporting ? "Выгрузка..." : "Скачать submission"}
          </Button>
        )}
        {onOpenHistory && (
          <Button variant="secondary" onClick={onOpenHistory}>
            Открыть в истории
          </Button>
        )}
        <Button variant="primary" onClick={onNewStudy}>
          Новое исследование
        </Button>
      </div>
      {exportError && (
        <p className={styles.exportError} role="alert">
          {exportError}
        </p>
      )}
    </section>
  );
}
