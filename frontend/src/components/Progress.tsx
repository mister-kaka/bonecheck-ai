import styles from "./Progress.module.css";

interface ProgressProps {
  /** Процент заполнения 0–100. Значения за пределами обрезаются */
  value: number;
  /** Подпись для скринридеров */
  ariaLabel?: string;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function Progress({ value, ariaLabel = "Прогресс загрузки" }: ProgressProps) {
  const percent = clampPercent(value);

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  );
}
