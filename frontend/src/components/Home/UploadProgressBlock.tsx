import { CircularProgress } from "./CircularProgress";
import styles from "../../styles/UploadProgressBlock.module.css";

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
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <CircularProgress value={progress} size={100} strokeWidth={8} />

        <div className={styles.info}>
          <h2 className={styles.title}>Загрузка файлов...</h2>
          <div className={styles.fileName}>{fileName}</div>
          <div className={styles.meta}>
            Размер: {fileSize} | Формат: {fileFormat}
          </div>
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