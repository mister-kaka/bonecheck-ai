import type { StudyResultPayload } from "../types/study";

export const MOCK_RESULT_OK: StudyResultPayload = {
  studyId: "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  quality_class: 0,
  violation_type: "",
  quality_prob: 0.05,
  anatomical_region: "Поясничный отдел позвоночника",
};

export const MOCK_RESULT_SPINE_VIOLATION: StudyResultPayload = {
  studyId: "8f14e45f-ceea-4e7a-9b1d-2c3a4d5e6f70",
  quality_class: 1,
  violation_type: "Не выравнена ось позвоночника;Присутствуют посторонние предметы",
  quality_prob: 0.87,
  anatomical_region: "Поясничный отдел позвоночника",
};

export const MOCK_RESULT_SPINE_POSITION: StudyResultPayload = {
  studyId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  quality_class: 1,
  violation_type: "Некорректная укладка",
  quality_prob: 0.66,
  anatomical_region: "Поясничный отдел позвоночника",
};

export const MOCK_RESULT_HIP_VIOLATION: StudyResultPayload = {
  studyId: "c9f0f895-fb98-4b91-8e3a-7d6c5b4a3921",
  quality_class: 1,
  violation_type: "Некорректная область интереса",
  quality_prob: 0.74,
  anatomical_region: "Проксимальный отдел бедра",
};

/** quality_prob нет специально: поле необязательное. */
export const MOCK_RESULT_HIP_OK: StudyResultPayload = {
  studyId: "45c48cce-2e2d-4fbd-aa1a-4c5b6d7e8f92",
  quality_class: 0,
  violation_type: "",
  anatomical_region: "Проксимальный отдел бедра",
};

export const MOCK_RESULT_HIP_OK_PROB: StudyResultPayload = {
  studyId: "1b4e28ba-2fa1-41d7-8a3c-5e6f708192a3",
  quality_class: 0,
  violation_type: "",
  quality_prob: 0.08,
  anatomical_region: "Проксимальный отдел бедра",
};
