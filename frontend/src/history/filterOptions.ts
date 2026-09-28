import { VIOLATION_FILTER_VALUES } from "../api/layoutCriteria";
import type { SelectOption } from "../types/study";
import { formatDay } from "./formatDate";
import type { HistoryQuery } from "./queryHistory";

export type HistoryFilterChip = {
  id: string;
  label: string;
};

export const regionFilterOptions: SelectOption[] = [
  { value: "all", label: "Все области" },
  { value: "Поясничный отдел позвоночника", label: "Поясничный отдел позвоночника" },
  { value: "Проксимальный отдел бедра", label: "Проксимальный отдел бедра" },
];

export const violationFilterOptions: SelectOption[] = [
  { value: "all", label: "Все типы" },
  ...VIOLATION_FILTER_VALUES.map((value) => ({ value, label: value })),
];

export const outcomeFilterOptions: SelectOption[] = [
  { value: "all", label: "Все статусы" },
  { value: "quality", label: "Без нарушений" },
  { value: "violation", label: "Нарушение" },
  { value: "processing", label: "Идёт анализ" },
  { value: "error", label: "Ошибка" },
];

export const sortOptions: SelectOption[] = [
  { value: "date_desc", label: "Сначала новые" },
  { value: "date_asc", label: "Сначала старые" },
];

export const pageSizeOptions: SelectOption[] = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "20", label: "20" },
];

function optionLabel(options: SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function historyFilterChips(query: HistoryQuery): HistoryFilterChip[] {
  return [
    query.region !== "all"
      ? { id: "region", label: optionLabel(regionFilterOptions, query.region) }
      : null,
    query.outcome !== "all"
      ? { id: "outcome", label: optionLabel(outcomeFilterOptions, query.outcome) }
      : null,
    query.violation !== "all"
      ? { id: "violation", label: optionLabel(violationFilterOptions, query.violation) }
      : null,
    query.dateFrom
      ? { id: "dateFrom", label: `С ${formatDay(query.dateFrom)}` }
      : null,
    query.dateTo
      ? { id: "dateTo", label: `По ${formatDay(query.dateTo)}` }
      : null,
  ].filter((chip): chip is HistoryFilterChip => chip !== null);
}
