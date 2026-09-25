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
      <h2 className={styles.title}>Загрузка файлов...</h2>

      <CircularProgress value={progress} size={160} strokeWidth={12} />

      <p className={styles.fileName}>{fileName}</p>

      <p className={styles.fileMeta}>
        Размер: {fileSize} | Формат: {fileFormat}
      </p>

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