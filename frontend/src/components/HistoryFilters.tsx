import { Input } from './Input';
import { Select } from './Select';
import type { SelectOption } from '../types/study';
import styles from '../styles/HistoryFilters.module.css';

interface HistoryFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;

  region: string;
  onRegionChange: (v: string) => void;
  regionOptions: SelectOption[];

  status: string;
  onStatusChange: (v: string) => void;
  statusOptions: SelectOption[];

  sort: string;
  onSortChange: (v: string) => void;
  sortOptions: SelectOption[];
}

export function HistoryFilters({
  search,
  onSearchChange,
  region,
  onRegionChange,
  regionOptions,
  status,
  onStatusChange,
  statusOptions,
  sort,
  onSortChange,
  sortOptions,
}: HistoryFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.searchField}>
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по UID"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      <div className={styles.selectField}>
        <Select
          options={regionOptions}
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
        />
      </div>

      <div className={styles.selectField}>
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        />
      </div>

      <div className={styles.selectField}>
        <Select
          options={sortOptions}
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        />
      </div>
    </div>
  );
}