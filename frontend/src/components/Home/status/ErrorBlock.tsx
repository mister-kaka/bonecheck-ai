import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import styles from "./ErrorBlock.module.css";

interface ErrorBlockProps {
  title: string;
  message: string;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ErrorBlock({
  title,
  message,
  actionLabel = "Загрузить другой файл",
  onRetry,
}: ErrorBlockProps) {
  return (
    <section className={styles.errorBlock} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <Icon name="error" size={20} />
      </span>

      <div className={styles.copy}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{message}</p>
      </div>

      <Button variant="secondary" onClick={onRetry}>
        {actionLabel}
      </Button>
    </section>
  );
}
