import { Icon } from "../ui/Icon";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "Нет исследований",
  subtitle = "По выбранным фильтрам ничего не найдено",
  actionLabel = "Сбросить фильтры",
  onAction,
}: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size={22} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.subtitle}>{subtitle}</p>

      {onAction && (
        <button type="button" className={styles.resetBtn} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
