import type { StudyResultPayload, StudyStatus } from "../types/study";
import { criteriaForRegion, type CriterionRow } from "./layoutCriteria";

export type { StudyResultPayload as ApiStudyResult };
export type { CriterionRow };

export type StudyResultView = {
  isOk: boolean;
  region: string;
  qualityProb?: number;
  violations: string[];
  criteria: CriterionRow[];
  summary: string;
};

/** Текст колонки «Нарушение». Пустой violation_type: «Без нарушений». Незавершённый статус: «-». */
export function historyViolationText(
  status: StudyStatus,
  violationType: string | null | undefined,
): string {
  if (status !== "completed" || violationType == null) return "-";
  if (violationType.length === 0) return "Без нарушений";
  return violationType;
}

/** Делим violation_type по ";" без обрезки пробелов. У класса 0 строка пустая. */
export function splitViolationTypes(violationType: string): string[] {
  if (violationType.length === 0) return [];
  return violationType.split(";").filter((item) => item.length > 0);
}

export function mapStudyResult(result: StudyResultPayload): StudyResultView {
  const isOk = result.quality_class === 0;
  const violations = isOk ? [] : splitViolationTypes(result.violation_type);

  let summary: string;
  if (!isOk && violations.length > 1) {
    summary = "Обнаружено несколько нарушений качества укладки.";
  } else if (!isOk) {
    summary = "Обнаружено нарушение качества укладки.";
  } else {
    summary = "Нарушений качества укладки не обнаружено.";
  }

  return {
    isOk,
    region: result.anatomical_region,
    qualityProb: result.quality_prob,
    violations,
    criteria: criteriaForRegion(result.anatomical_region, violations),
    summary,
  };
}
