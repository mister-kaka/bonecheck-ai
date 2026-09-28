import { Icon } from "../../ui/Icon";
import styles from "./AnalysisBlock.module.css";

interface AnalysisBlockProps {
  region?: string;
  fileName?: string;
  progress?: number;
  onCancel?: () => void;
}

export function AnalysisBlock({
  region,
  fileName,
  progress,
  onCancel,
}: AnalysisBlockProps) {
  const hasProgress = progress !== undefined;
  const value = hasProgress ? Math.max(0, Math.min(100, Math.round(progress))) : 0;

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
              Анатомическая область: <strong>{region}</strong>
            </p>
          )}
          <p className={styles.next}>
            Результат появится на этом экране.
          </p>
        </div>
      </div>

      <div className={styles.meter}>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuenow={hasProgress ? value : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={hasProgress ? undefined : "Ожидание ответа сервера"}
          aria-label="Проверка качества укладки"
          aria-busy={hasProgress ? undefined : true}
        >
          <span
            className={hasProgress ? styles.fill : `${styles.fill} ${styles.fillIndeterminate}`}
            ref={
              hasProgress
                ? (node) => node?.style.setProperty("--progress", `${value}%`)
                : undefined
            }
          />
        </div>
        <span className={styles.value}>{hasProgress ? `${value}%` : "идёт"}</span>
      </div>

      <button type="button" className={styles.cancelBtn} onClick={onCancel}>
        Прервать ожидание
      </button>
      <p className={styles.cancelNote}>
        Останавливается только этот экран. Если файл уже принят, исследование останется в истории.
      </p>
    </div>
  );
}
