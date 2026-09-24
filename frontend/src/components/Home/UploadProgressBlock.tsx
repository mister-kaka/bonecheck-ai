import { Button } from "../Button";
import { Progress } from "../Progress";
import styles from "../../styles/UploadProgressBlock.module.css";

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

interface UploadProgressBlockProps {
  fileName?: string;
  fileSize?: string;
  fileFormat?: string;
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
  const percent = clamp(value);

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

      <Progress value={percent} label={`Загрузка файла ${fileName}`} />

      <p className={styles.status}>Загрузка... {Math.round(percent)}%</p>
    </section>
  );
}
