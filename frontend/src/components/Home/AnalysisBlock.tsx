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
      <h2 className={styles.title}>Анализ исследования...</h2>

      <CircularProgress value={progress} size={160} strokeWidth={12} />

      {region && (
        <p className={styles.region}>
          Определение региона: <strong>{region}</strong>
        </p>
      )}

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