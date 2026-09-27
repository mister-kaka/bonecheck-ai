import type { StudyResultPayload } from "../types/study";

export type { StudyResultPayload as ApiStudyResult };

export type StudyResultView = {
  isOk: boolean;
  region: string;
  qualityProb?: number;
  violations: string[];
  summary: string;
};

/** Splits violation_type on ";" without trimming. A valid class-0 value is "". */
export function splitViolationTypes(violationType: string): string[] {
  if (violationType.length === 0) return [];
  return violationType.split(";").filter((item) => item.length > 0);
}

export function mapStudyResult(result: StudyResultPayload): StudyResultView {
  const isOk = result.quality_class === 0;
  const violations = isOk ? [] : splitViolationTypes(result.violation_type);

  let summary: string;
  if (!isOk && violations.length > 1) {
    summary =
      "Обнаружено несколько нарушений качества укладки. Это не клинический диагноз и не измерение минеральной плотности.";
  } else if (!isOk) {
    summary =
      "Обнаружено нарушение качества укладки. Это не клинический диагноз и не измерение минеральной плотности.";
  } else {
    summary =
      "Нарушений качества укладки не обнаружено. Это не клинический диагноз и не измерение минеральной плотности.";
  }

  return {
    isOk,
    region: result.anatomical_region,
    qualityProb: result.quality_prob,
    violations,
    summary,
  };
}
