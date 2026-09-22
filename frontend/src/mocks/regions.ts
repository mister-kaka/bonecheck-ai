import type { SelectOption } from "../types/study";

/*  Опции для селектов в фильтрах истории  */

export const mockRegions: SelectOption[] = [
  { value: "all", label: "Все регионы" },
  { value: "Поясничный отдел позвоночника", label: "Поясничный отдел позвоночника" },
  { value: "Проксимальный отдел бедра", label: "Проксимальный отдел бедра" },
];

export const mockStatuses: SelectOption[] = [
  { value: "all", label: "Все статусы" },
  { value: "quality", label: "Качественно" },
  { value: "violation", label: "Нарушение" },
  { value: "error", label: "Ошибка" },
];

export const mockSorts: SelectOption[] = [
  { value: "date_desc", label: "Сначала новые" },
  { value: "date_asc", label: "Сначала старые" },
];
