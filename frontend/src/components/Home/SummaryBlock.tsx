import type { ReactNode } from "react";
import styles from "../../styles/SummaryBlock.module.css";

interface SummaryBlockProps {
  /** Текст заключения. Можно передать строку или разметку */
  children: ReactNode;
  title?: string;
}

export function SummaryBlock({ children, title = "Общее заключение" }: SummaryBlockProps) {
  return (
    <section className={styles.block} aria-labelledby="summary-block-title">
      <span className={styles.icon} aria-hidden="true">
        i
      </span>

      <div className={styles.body}>
        <h3 id="summary-block-title" className={styles.title}>
          {title}
        </h3>
        <div className={styles.text}>{children}</div>
      </div>
    </section>
  );
}
