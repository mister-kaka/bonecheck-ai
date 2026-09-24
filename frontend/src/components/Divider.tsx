import styles from "../styles/Divider.module.css";

interface DividerProps {
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
