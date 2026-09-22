import styles from "./Skeleton.module.css";

interface SkeletonProps {
  /** Число — в пикселях, строка — любое CSS-значение ("100%", "12rem") */
  width?: number | string;
  height?: number | string;
  /** Круглая заглушка (для аватаров, иконок) */
  circle?: boolean;
}

export function Skeleton({ width = "100%", height = 16, circle = false }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${circle ? styles.circle : ""}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
