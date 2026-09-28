import type { AnatomicalRegion } from "../types/study";

/** Закрытый словарь ТЗ. Формулировки не перефразируются. */
export const SPINE_CRITERIA = [
  "Некорректная укладка",
  "Не выравнена ось позвоночника",
  "Присутствуют посторонние предметы",
] as const;

export const HIP_CRITERIA = [
  "Некорректная укладка",
  "Некорректная область интереса",
] as const;

/** Уникальные значения словаря. «Некорректная укладка» есть у обеих областей. */
export const VIOLATION_FILTER_VALUES = [
  "Некорректная укладка",
  "Не выравнена ось позвоночника",
  "Присутствуют посторонние предметы",
  "Некорректная область интереса",
] as const;

export type ViolationFilterValue = (typeof VIOLATION_FILTER_VALUES)[number];

const CRITERIA_BY_REGION: Record<AnatomicalRegion, readonly string[]> = {
  "Поясничный отдел позвоночника": SPINE_CRITERIA,
  "Проксимальный отдел бедра": HIP_CRITERIA,
};

export type CriterionRow = {
  title: string;
  found: boolean;
};

/** Критерии только выбранной области. Чужой регион в список не входит. */
export function criteriaForRegion(
  region: string,
  violations: readonly string[],
): CriterionRow[] {
  const list = CRITERIA_BY_REGION[region as AnatomicalRegion];
  if (!list) return [];
  return list.map((title) => ({
    title,
    found: violations.includes(title),
  }));
}
