import styles from "../styles/Spinner.module.css";

interface SpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ label, size = "md" }: SpinnerProps) {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.spinner} ${styles[size]}`} aria-hidden />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
