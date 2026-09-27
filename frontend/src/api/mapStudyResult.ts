/**
 * Поля успешного GET /api/studies/:id/result.
 * Источник: docs/api.md. Мок истории и StudyResult в types/study.ts шире этого контракта.
 */
export type ApiStudyResult = {
  studyId: string;
  quality_class: 0 | 1;
  violation_type: string;
  quality_prob?: number;
  anatomical_region?: string;
};

export type StudyResultView = {
  isOk: boolean;
  region: string;
  qualityProb?: number;
  violations: string[];
  summary: string;
};

const REGION_FALLBACK = "Область не определена";

export function splitViolationTypes(violationType: string): string[] {
  return violationType
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function mapStudyResult(result: ApiStudyResult): StudyResultView {
  const violations = splitViolationTypes(result.violation_type);
  const isOk = result.quality_class === 0;
  const region = result.anatomical_region?.trim() || REGION_FALLBACK;

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
    region,
    qualityProb: result.quality_prob,
    violations,
    summary,
  };
}
