import styles from "./Divider.module.css";

interface DividerProps {
  /** Подпись по центру линии. Если не передана — обычная линия */
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (!label) {
    return <hr className={styles.line} />;
  }

  return (
    <div className={styles.labeled} role="separator" aria-label={label}>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
