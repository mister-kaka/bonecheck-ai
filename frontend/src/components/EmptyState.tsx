import styles from './EmptyState.module.css';

interface EmptyStateProps {
  onResetFilters?: () => void;
}

export function EmptyState({ onResetFilters }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon} aria-hidden="true">📋</span>
      <h3 className={styles.title}>Нет исследований</h3>
      <p className={styles.subtitle}>По выбранным фильтрам ничего не найдено</p>

      {onResetFilters && (
        <button
          type="button"
          className={styles.resetBtn}
          onClick={onResetFilters}
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}