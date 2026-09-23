import styles from "../styles/Progress.module.css";

interface ProgressProps {
  value: number;
  label?: string;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function Progress({ value, label = "Прогресс загрузки" }: ProgressProps) {
  const percent = clampPercent(value);

  return <progress className={styles.bar} max={100} value={percent} aria-label={label} />;
}
