import { Icon } from "../Icon";
import styles from "../../styles/HistoryFilters.module.css";
import { Input } from "../Input";
import { Select } from "../Select";
import type { SelectOption } from "../../types/study";

export interface ActiveFilterChip {
  id: string;
  label: string;
}

interface HistoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;

  region: string;
  onRegionChange: (value: string) => void;
  regionOptions: SelectOption[];

  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: SelectOption[];

  sort: string;
  onSortChange: (value: string) => void;
  sortOptions: SelectOption[];

  chips: ActiveFilterChip[];
  onClearChip: (id: string) => void;
  onResetAll?: () => void;
  disabled?: boolean;
}

export function HistoryFilters({
  search,
  onSearchChange,
  onClearSearch,
  region,
  onRegionChange,
  regionOptions,
  status,
  onStatusChange,
  statusOptions,
  sort,
  onSortChange,
  sortOptions,
  chips,
  onClearChip,
  onResetAll,
  disabled = false,
}: HistoryFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.grid}>
        <div className={styles.searchField}>
          <span className={styles.label} id="history-search-label">Файл</span>
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Имя файла"
            aria-labelledby="history-search-label"
            icon={<Icon name="search" size={16} />}
            disabled={disabled}
          />
        </div>

        <div className={styles.selectField}>
          <label className={styles.label} htmlFor="history-region">Область</label>
          <Select
            id="history-region"
            aria-label="Анатомическая область"
            options={regionOptions}
            value={region}
            disabled={disabled}
            onChange={(event) => onRegionChange(event.target.value)}
          />
        </div>

        <div className={styles.selectField}>
          <label className={styles.label} htmlFor="history-status">Результат</label>
          <Select
            id="history-status"
            aria-label="Статус проверки"
            options={statusOptions}
            value={status}
            disabled={disabled}
            onChange={(event) => onStatusChange(event.target.value)}
          />
        </div>

        <div className={styles.selectField}>
          <label className={styles.label} htmlFor="history-sort">Порядок</label>
          <Select
            id="history-sort"
            aria-label="Сортировка"
            options={sortOptions}
            value={sort}
            disabled={disabled}
            onChange={(event) => onSortChange(event.target.value)}
          />
        </div>
      </div>

      {(chips.length > 0 || onResetAll) && (
        <div className={styles.chips}>
          {search.trim().length > 0 && (
            <button
              type="button"
              className={styles.chip}
              onClick={onClearSearch}
              disabled={disabled}
            >
              Файл: {search.trim()}
              <span aria-hidden="true">×</span>
            </button>
          )}
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={styles.chip}
              onClick={() => onClearChip(chip.id)}
              disabled={disabled}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          {onResetAll && (
            <button
              type="button"
              className={styles.resetAll}
              onClick={onResetAll}
              disabled={disabled}
            >
              <Icon name="reset" size={14} />
              Сбросить всё
            </button>
          )}
        </div>
      )}
    </div>
  );
}
