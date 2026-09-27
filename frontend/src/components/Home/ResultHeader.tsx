import { Badge } from "../Badge";
import { Button } from "../Button";
import styles from "../../styles/ResultHeader.module.css";

interface ResultHeaderProps {
  isOk: boolean;
  region: string;
  /** Вероятность нарушения quality_prob, 0–1. В процентах. */
  qualityProb?: number;
  title?: string;
  onExport?: () => void;
  onNewStudy?: () => void;
}

export function ResultHeader({
  isOk,
  region,
  qualityProb,
  title = "Результат исследования",
  onExport,
  onNewStudy,
}: ResultHeaderProps) {
  const percent =
    qualityProb === undefined
      ? undefined
      : Math.round(Math.min(1, Math.max(0, qualityProb)) * 100);

  return (
    <header className={styles.header}>
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {isOk ? (
            <Badge tone="success">✓ Укладка корректна</Badge>
          ) : (
            <Badge tone="warning">⚠ Нарушение укладки</Badge>
          )}
        </div>

        <dl className={styles.chips}>
          <div className={styles.chip}>
            <dt>Регион:</dt>
            <dd>{region}</dd>
          </div>
          {percent !== undefined && (
            <div className={styles.chip}>
              <dt>Вероятность нарушения:</dt>
              <dd>{percent}%</dd>
            </div>
          )}
        </dl>
      </div>

      <div className={styles.actions}>
        {onExport && (
          <Button variant="primary" iconLeft="⭳" onClick={onExport}>
            Экспорт XLSX
          </Button>
        )}
        <Button variant="secondary" onClick={onNewStudy}>
          Новое исследование
        </Button>
      </div>
    </header>
  );
}
