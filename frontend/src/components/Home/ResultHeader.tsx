import { Badge } from "../Badge";
import { Button } from "../Button";
import styles from "../../styles/ResultHeader.module.css";

interface ResultHeaderProps {
  isOk: boolean;
  region: string;
  /** Уверенность модели 0–1, выводится в процентах */
  confidence: number;
  title?: string;
  onExport?: () => void;
  onNewStudy?: () => void;
}

export function ResultHeader({
  isOk,
  region,
  confidence,
  title = "Результат исследования",
  onExport,
  onNewStudy,
}: ResultHeaderProps) {
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);

  return (
    <header className={styles.header}>
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {isOk ? (
            <Badge tone="success">✓ Исследование корректно</Badge>
          ) : (
            <Badge tone="warning">⚠ Обнаружено нарушение</Badge>
          )}
        </div>

        <dl className={styles.chips}>
          <div className={styles.chip}>
            <dt>Регион:</dt>
            <dd>{region}</dd>
          </div>
          <div className={styles.chip}>
            <dt>Уверенность:</dt>
            <dd>{percent}%</dd>
          </div>
        </dl>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" iconLeft="⭳" onClick={onExport}>
          Экспорт XLSX
        </Button>
        <Button variant="secondary" onClick={onNewStudy}>
          Новое исследование
        </Button>
      </div>
    </header>
  );
}
