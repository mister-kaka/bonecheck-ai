import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import { Skeleton } from "../Skeleton";
import { formatDate } from "../../history/formatDate";
import type { DemoStudy } from "../../mocks/history";
import styles from "../../styles/HistoryTable.module.css";

interface HistoryTableProps {
  items: DemoStudy[];
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRowClick?: (item: DemoStudy) => void;
}

export function HistoryTable({
  items,
  loading = false,
  emptyTitle,
  emptySubtitle,
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
}: HistoryTableProps) {
  if (loading) {
    return (
      <div className={styles.tableWrapper} aria-busy="true" aria-live="polite">
        <p className={styles.loadingLabel}>Загрузка истории</p>
        <table className={styles.table}>
          <TableHead />
          <tbody>
            {Array.from({ length: 5 }, (_, index) => (
              <tr key={index}>
                <td><Skeleton /></td>
                <td><Skeleton /></td>
                <td><Skeleton /></td>
                <td><Skeleton /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        subtitle={emptySubtitle}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <TableHead />
        <tbody>
          {items.map((item) => {
            const region = item.result?.anatomical_region ?? "-";
            const qualityClass = item.result?.quality_class ?? null;
            return (
              <tr
                key={item.study.id}
                data-study-id={item.study.id}
                className={onRowClick ? `${styles.row} ${styles.rowInteractive}` : styles.row}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? `Открыть ${item.study.originalFileName}` : undefined}
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
                <td data-label="Дата">{formatDate(item.study.createdAt)}</td>
                <td className={styles.fileName} data-label="Файл">
                  {item.study.originalFileName}
                </td>
                <td data-label="Область">{region}</td>
                <td data-label="Статус">
                  <StatusBadge status={item.study.status} qualityClass={qualityClass} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableHead() {
  return (
    <thead>
      <tr>
        <th scope="col" className={styles.thDate}>Дата</th>
        <th scope="col" className={styles.thFile}>Файл</th>
        <th scope="col" className={styles.thRegion}>Область</th>
        <th scope="col" className={styles.thStatus}>Статус</th>
      </tr>
    </thead>
  );
}
