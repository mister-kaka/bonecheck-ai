import { CircularProgress } from "./CircularProgress";
import styles from "../../styles/AnalysisBlock.module.css";

interface AnalysisBlockProps {
  region?: string;
  progress: number;
  onCancel?: () => void;
}

export function AnalysisBlock({
  region,
  progress,
  onCancel,
}: AnalysisBlockProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <CircularProgress value={progress} size={100} strokeWidth={8} />

        <div className={styles.info}>
          <h2 className={styles.title}>Анализ исследования...</h2>
          {region && (
            <p className={styles.region}>
              Определение региона: <strong>{region}</strong>
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        className={styles.cancelBtn}
        onClick={onCancel}
      >
        Отмена
      </button>
    </div>
  );
}