import styles from "../../styles/CheckDetail.module.css";

export type CheckTone = "success" | "warning" | "danger";

interface CheckDetailProps {
  index: number;
  title: string;
  status: string;
  tone?: CheckTone;
  items?: string[];
}

const ICON: Record<CheckTone, string> = {
  success: "✓",
  warning: "!",
  danger: "✕",
};

export function CheckDetail({
  index,
  title,
  status,
  tone = "success",
  items = [],
}: CheckDetailProps) {
  return (
    <article className={`${styles.check} ${styles[tone]}`}>
      <span className={styles.icon} aria-hidden="true">
        {ICON[tone]}
      </span>

      <div className={styles.body}>
        <h4 className={styles.title}>
          {index}. {title}
        </h4>

        <p className={styles.statusLine}>
          Статус: <span className={styles.status}>{status}</span>
        </p>

        {items.length > 0 && (
          <>
            <p className={styles.descLabel}>Описание:</p>
            <ul className={styles.items}>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}
