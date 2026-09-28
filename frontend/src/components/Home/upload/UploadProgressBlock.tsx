import { Icon } from "../../ui/Icon";
import styles from "./UploadProgressBlock.module.css";

interface UploadProgressBlockProps {
  fileName: string;
  fileSize: string;
  fileFormat: string;
  progress: number;
  onCancel?: () => void;
}

export function UploadProgressBlock({
  fileName,
  fileSize,
  fileFormat,
  progress,
  onCancel,
}: UploadProgressBlockProps) {
  const value = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="file" size={18} />
        </span>
        <div className={styles.info}>
          <p className={styles.stage}>Приём файла</p>
          <h2 className={styles.title}>Загрузка файла</h2>
          <p className={styles.fileName} title={fileName}>{fileName}</p>
          <p className={styles.meta}>
            {fileSize} · {fileFormat}
          </p>
          <p className={styles.next}>После загрузки начнётся проверка укладки.</p>
        </div>
      </div>

      <div className={styles.meter}>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Приём файла"
        >
          <span
            className={styles.fill}
            ref={(node) => node?.style.setProperty("--progress", `${value}%`)}
          />
        </div>
        <span className={styles.value}>{value}%</span>
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
