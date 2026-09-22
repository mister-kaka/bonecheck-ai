import { Button } from "../Button";
import { Progress } from "../Progress";
import styles from "./UploadProgressBlock.module.css";

interface UploadProgressBlockProps {
  fileName?: string;
  fileSize?: string;
  fileFormat?: string;
  /** Процент загрузки 0–100 */
  value?: number;
  onCancel?: () => void;
}

export function UploadProgressBlock({
  fileName = "CR000000.dcm",
  fileSize = "4,2 МБ",
  fileFormat = "DICOM",
  value = 67,
  onCancel,
}: UploadProgressBlockProps) {
  return (
    <section className={styles.uploadProgressBlock}>
      <div className={styles.head}>
        <div className={styles.fileInfo}>
          <span className={styles.fileIcon} aria-hidden="true">
            📄
          </span>
          <div className={styles.fileText}>
            <p className={styles.fileName}>{fileName}</p>
            <p className={styles.fileMeta}>
              {fileSize} · {fileFormat}
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" iconLeft="✕" onClick={onCancel}>
          Отмена
        </Button>
      </div>

      <Progress value={value} ariaLabel={`Загрузка файла ${fileName}`} />

      <p className={styles.status}>Загрузка… {Math.round(value)}%</p>
    </section>
  );
}
