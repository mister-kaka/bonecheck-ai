import { Badge } from "../Badge";
import { Button } from "../Button";
import { Icon } from "../Icon";
import styles from "../../styles/ResultCard.module.css";

interface ResultCardProps {
  isOk: boolean;
  region: string;
  qualityProb?: number;
  violations?: string[];
  description?: string;
  onExport?: () => void;
  onNewStudy?: () => void;
}

export function ResultCard({
  isOk,
  region,
  qualityProb,
  violations = [],
  description,
  onExport,
  onNewStudy,
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
        <span className={styles.icon} aria-hidden="true">
          <Icon name={isOk ? "check" : "alert"} size={18} />
        </span>
        <div className={styles.headText}>
          <p className={styles.kicker}>Результат проверки укладки</p>
          <h2 className={styles.title}>
            {isOk ? "Укладка корректна" : "Нарушение качества укладки"}
          </h2>
          {isOk ? (
            <Badge tone="success">
              <Icon name="check" size={12} />
              Качественно
            </Badge>
          ) : (
            <Badge tone="warning">
              <Icon name="alert" size={12} />
              Нарушение
            </Badge>
          )}
        </div>
      </header>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Анатомическая область</dt>
          <dd>{region}</dd>
        </div>
        {percent !== undefined && (
          <div className={styles.fact}>
            <dt>Вероятность нарушения</dt>
            <dd className={styles.prob}>
              <span className={styles.probValue}>{percent}%</span>
            </dd>
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

      {description && <p className={styles.description}>{description}</p>}

      <div className={styles.actions}>
        {onExport && (
          <Button variant="secondary" onClick={onExport}>
            Экспорт XLSX
          </Button>
        )}
        <Button variant="primary" onClick={onNewStudy}>
          Новое исследование
        </Button>
      </div>
    </section>
  );
}
