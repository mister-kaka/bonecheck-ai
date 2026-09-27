import type { SelectOption } from "../types/study";

export const regionFilterOptions: SelectOption[] = [
  { value: "all", label: "Все регионы" },
  { value: "Поясничный отдел позвоночника", label: "Поясничный отдел позвоночника" },
  { value: "Проксимальный отдел бедра", label: "Проксимальный отдел бедра" },
];

export const outcomeFilterOptions: SelectOption[] = [
  { value: "all", label: "Все статусы" },
  { value: "quality", label: "Качественно" },
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
