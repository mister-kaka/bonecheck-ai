import { EmptyState } from './EmptyState';
import type { HistoryItem } from '../types/study';
import styles from '../styles/HistoryTable.module.css';

interface HistoryTableProps {
  items: HistoryItem[];
  onRowClick?: (item: HistoryItem) => void;
  onResetFilters?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function getStatusLabel(item: HistoryItem): string {
  if (item.status === 'Failure') return 'Ошибка';
  if (item.quality_class === 1) return 'Нарушение';
  return 'Качественно';
}

function getQualityLabel(item: HistoryItem): string {
  if (item.status === 'Failure') return 'Ошибка обработки';
  if (item.quality_class === 1) return 'Некорректно';
  if (item.quality_class === 0) return 'Корректно';
  return '—';
}

export function HistoryTable({ items, onRowClick, onResetFilters }: HistoryTableProps) {
  if (items.length === 0) {
    return <EmptyState onResetFilters={onResetFilters} />;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thDate}>Дата</th>
            <th className={styles.thUid}>UID</th>
            <th className={styles.thRegion}>Регион</th>
            <th className={styles.thStatus}>Статус</th>
            <th className={styles.thQuality}>Качество</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={styles.row}
              onClick={() => onRowClick?.(item)}
            >
              <td>{formatDate(item.date)}</td>
              <td className={styles.uid}>{item.uid}</td>
              <td>{item.region}</td>
              <td>{getStatusLabel(item)}</td>
              <td>{getQualityLabel(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}