import { Button } from "../Button";
import styles from "../../styles/ErrorBlock.module.css";

interface ErrorBlockProps {
  title?: string;
  message?: string;
  reason?: string;
  onRetry?: () => void;
}

export function ErrorBlock({
  title = "Ошибка обработки",
  message,
  reason = "файл повреждён или имеет неподдерживаемый формат.",
  onRetry,
}: ErrorBlockProps) {
  return (
    <section className={styles.errorBlock} role="alert">
      <span className={styles.icon} aria-hidden="true">
        ✕
      </span>

      <h2 className={styles.title}>{title}</h2>

      <p className={styles.text}>
        {message ?? `Не удалось обработать DICOM-файл. Причина: ${reason}`}
      </p>

      <Button variant="secondary" onClick={onRetry}>
        Загрузить другой файл
      </Button>
    </section>
  );
}
