import { Icon } from "../Icon";
import styles from "../../styles/AnalysisBlock.module.css";

interface AnalysisBlockProps {
  region?: string;
  fileName?: string;
  progress: number;
  onCancel?: () => void;
}

export function AnalysisBlock({
  region,
  fileName,
  progress,
  onCancel,
}: AnalysisBlockProps) {
  const value = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="study" size={18} />
        </span>
        <div className={styles.info}>
          <p className={styles.stage}>Анализ</p>
          <h2 className={styles.title}>Проверка качества укладки</h2>
          {fileName && (
            <p className={styles.fileName} title={fileName}>{fileName}</p>
          )}
          {region && (
            <p className={styles.region}>
              Определение региона: <strong>{region}</strong>
            </p>
          )}
        </div>
      </div>

      <div className={styles.meter}>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Проверка качества укладки"
        >
          <span className={styles.fill} style={{ width: `${value}%` }} />
        </div>
        <span className={styles.value}>{value}%</span>
      </div>

      <button type="button" className={styles.cancelBtn} onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}
