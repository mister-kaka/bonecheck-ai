import { statusLabel } from "../../HistoryPage/StatusBadge";
import { Button } from "../../ui/Button";
import type { PackageStudyItem } from "../../../types/study";
import styles from "../../../pages/Home/Home.module.css";

interface PackageOutcomeProps {
  archiveName: string;
  items: PackageStudyItem[];
  onOpenStudy: (id: string) => void;
  onOpenHistory: () => void;
  onNewStudy: () => void;
}

export function PackageOutcome({
  archiveName,
  items,
  onOpenStudy,
  onOpenHistory,
  onNewStudy,
}: PackageOutcomeProps) {
  const ready = items.filter((item) => item.status === "completed").length;

  return (
    <section className={styles.package} aria-label="Результат пакета">
      <div>
        <p className={styles.packageKicker}>Пакет</p>
        <h2 className={styles.packageTitle}>Архив принят</h2>
        <p className={styles.packageLead}>
          {archiveName}. Создано исследований: {items.length}. Готово: {ready}.
          Каждое изображение проверяется отдельно.
        </p>
      </div>

      <ul className={styles.packageList}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.packageItem}
              onClick={() => onOpenStudy(item.id)}
            >
              <span className={styles.packageName}>{item.fileName}</span>
              <span className={styles.packageStatus}>
                <span>{statusLabel(item.status)}</span>
                {item.layoutLabel && (
                  <span className={styles.packageOutcome}>{item.layoutLabel}</span>
                )}
              </span>
            </button>
            {item.error && <p className={styles.packageError}>{item.error}</p>}
          </li>
        ))}
      </ul>

      <div className={styles.packageActions}>
        <Button variant="secondary" onClick={onOpenHistory}>
          К истории
        </Button>
        <Button variant="primary" onClick={onNewStudy}>
          Новое исследование
        </Button>
      </div>
    </section>
  );
}
