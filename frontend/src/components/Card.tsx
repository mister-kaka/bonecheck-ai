import { ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}

export function Card({
  title,
  subtitle,
  right,
  children,
  padded = true,
}: CardProps) {
  return (
    <section className={styles.card}>
      {(title || right) && (
        <header className={styles.head}>
          <div>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {right && <div>{right}</div>}
        </header>
      )}
      <div className={padded ? styles.body : undefined}>{children}</div>
    </section>
  );
}