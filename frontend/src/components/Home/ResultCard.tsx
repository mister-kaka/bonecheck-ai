import { Badge } from "../Badge";
import { Button } from "../Button";
import { Divider } from "../Divider";
import styles from "../../styles/ResultCard.module.css";

interface ResultCardProps {
  isOk: boolean;
  region: string;
  confidence: number;
  violations?: string[];
  description?: string;
  onExport?: () => void;
  onNewStudy?: () => void;
}

export function ResultCard({
  isOk,
  region,
  confidence,
  violations = [],
  description,
  onExport,
  onNewStudy,
}: ResultCardProps) {
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);

  return (
    <section className={styles.resultCard}>
      <header className={styles.head}>
        <span
          className={`${styles.icon} ${isOk ? styles.iconOk : styles.iconWarn}`}
          aria-hidden="true"
        >
          {isOk ? "✓" : "⚠"}
        </span>
        <div className={styles.headText}>
          <h2 className={styles.title}>
            {isOk ? "Исследование корректно" : "Обнаружено нарушение качества"}
          </h2>
          {isOk ? (
            <Badge tone="success">✓ Качественно</Badge>
          ) : (
            <Badge tone="warning">⚠ Нарушение</Badge>
          )}
        </div>
      </header>

      <dl className={styles.meta}>
        <div className={styles.metaRow}>
          <dt>Регион</dt>
          <dd>{region}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Уверенность</dt>
          <dd>{percent}%</dd>
        </div>
      </dl>

      {violations.length > 0 && (
        <>
          <Divider label="Нарушения" />
          <ul className={styles.violations}>
            {violations.map((violation) => (
              <li key={violation}>
                <Badge tone="warning">{violation}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}

      {description && (
        <>
          <Divider label="Описание" />
          <p className={styles.description}>{description}</p>
        </>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onExport}>
          Экспорт XLSX
        </Button>
        <Button variant="primary" onClick={onNewStudy}>
          Новое исследование
        </Button>
      </div>
    </section>
  );
}
