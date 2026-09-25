import styles from "../../styles/CircularProgress.module.css";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function CircularProgress({
  value,
  size = 160,
  strokeWidth = 10,
  label,
}: CircularProgressProps) {
  const safe = Math.max(0, Math.min(100, value));

  // Радиус окружности (по центру линии)
  const radius = (size - strokeWidth) / 2;
  // Длина окружности
  const circumference = 2 * Math.PI * radius;
  // Сколько «закрашено»
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className={styles.wrap}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
      >
        {/* Фоновый круг (полный) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-progress-track)"
          strokeWidth={strokeWidth}
        />
        {/* Активная дуга */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-progress)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.arc}
        />
      </svg>

      <div className={styles.center}>
        <span className={styles.value}>{Math.round(safe)}%</span>
        {label && <span className={styles.label}>{label}</span>}
      </div>
    </div>
  );
}