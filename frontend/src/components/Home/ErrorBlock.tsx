import { Button } from "../Button";
import styles from "./ErrorBlock.module.css";

interface ErrorBlockProps {
  reason?: string;
  onRetry?: () => void;
}

export function ErrorBlock({
  reason = "файл повреждён или имеет неподдерживаемый формат.",
  onRetry,
}: ErrorBlockProps) {
  return (
    <section className={styles.errorBlock} role="alert">
      <span className={styles.icon} aria-hidden="true">
        ✕
      </span>

      <h2 className={styles.title}>Ошибка обработки</h2>

      <p className={styles.text}>
        Не удалось обработать DICOM-файл. Причина: {reason}
      </p>

      <Button variant="secondary" onClick={onRetry}>
        Загрузить другой файл
      </Button>
    </section>
  );
}
