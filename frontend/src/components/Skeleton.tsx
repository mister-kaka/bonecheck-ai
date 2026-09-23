import styles from "../styles/Skeleton.module.css";

interface SkeletonProps {
  circle?: boolean;
}

export function Skeleton({ circle = false }: SkeletonProps) {
  const className = [styles.skeleton, circle ? styles.circle : ""].filter(Boolean).join(" ");

  return <span className={className} aria-hidden="true" />;
}
