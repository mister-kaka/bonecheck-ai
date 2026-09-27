import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import type { HistoryItem } from "../../types/study";
import styles from "../../styles/HistoryTable.module.css";

interface HistoryTableProps {
  items: HistoryItem[];
  onRowClick?: (item: HistoryItem) => void;
  onResetFilters?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function getQualityLabel(item: HistoryItem): string {
  if (item.status === "Failure") return "Ошибка обработки";
  if (item.quality_class === 1) return "Некорректно";
  if (item.quality_class === 0) return "Корректно";
  return "—";
}

export function HistoryTable({
  items,
  onRowClick,
  onResetFilters,
}: HistoryTableProps) {
  if (items.length === 0) {
    return <EmptyState onResetFilters={onResetFilters} />;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.thDate}>Дата</th>
            <th scope="col" className={styles.thUid}>UID</th>
            <th scope="col" className={styles.thRegion}>Регион</th>
            <th scope="col" className={styles.thStatus}>Статус</th>
            <th scope="col" className={styles.thQuality}>Качество</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={onRowClick ? `${styles.row} ${styles.rowInteractive}` : styles.row}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(item);
                      }
                    }
                  : undefined
              }
            >
              <td>{formatDate(item.date)}</td>
              <td className={styles.uid}>{item.uid}</td>
              <td>{item.region}</td>
              <td>
                <StatusBadge
                  status={item.status}
                  qualityClass={item.quality_class}
                />
              </td>
              <td>{getQualityLabel(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}