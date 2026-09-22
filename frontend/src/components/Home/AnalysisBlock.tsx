import { Spinner } from "../Spinner";
import styles from "./AnalysisBlock.module.css";

interface AnalysisBlockProps {
  /** Регион, который определила модель */
  region?: string;
  /** Сколько секунд идёт анализ */
  seconds?: number;
}

export function AnalysisBlock({
  region = "Проксимальный отдел бедра",
  seconds = 12,
}: AnalysisBlockProps) {
  return (
    <section className={styles.analysisBlock} aria-live="polite" aria-busy="true">
      <Spinner size="lg" />

      <h2 className={styles.title}>Анализ исследования...</h2>

      <div className={styles.details}>
        <p>
          Определение региона: <span className={styles.value}>{region}</span>
        </p>
        <p>
          Время: <span className={styles.value}>{seconds} сек</span>
        </p>
      </div>
    </section>
  );
}
