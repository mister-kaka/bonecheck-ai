import { Button } from "../Button";
import { Icon } from "../Icon";
import styles from "../../styles/UploadProgressBlock.module.css";

interface SelectedFileBlockProps {
  fileName: string;
  fileSize: string;
  fileFormat: string;
  onStart: () => void;
  onCancel: () => void;
}

export function SelectedFileBlock({
  fileName,
  fileSize,
  fileFormat,
  onStart,
  onCancel,
}: SelectedFileBlockProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="file" size={18} />
        </span>
        <div className={styles.info}>
          <p className={styles.stage}>Файл выбран</p>
          <h2 className={styles.title}>Можно начать проверку</h2>
          <p className={styles.fileName} title={fileName}>{fileName}</p>
          <p className={styles.meta}>
            {fileSize} · {fileFormat}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={onStart}>
          Начать проверку
        </Button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
