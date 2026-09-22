import type { StudyResult } from "../types/study";

/*  Мок-результаты анализа для главной (пока нет API)  */

/** Исследование корректно */
export const mockResultOk: StudyResult = {
  id: "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  path_to_study: "uploads/study_4012/CR000000.dcm",
  study_uid: "1.2.840.113619.2.110.4012",
  image_uid: "1.2.840.113619.2.110.4012.1.1",
  anatomical_region: "Поясничный отдел позвоночника",
  quality_class: 0,
  quality_prob: 0.05,
  violation_type: "",
  processing_status: "Success",
  time_of_processing: 12,
  description: "",
};

/** Обнаружено нарушение качества (несколько типов через «;») */
export const mockResultViolation: StudyResult = {
  id: "8f14e45f-ceea-4e7a-9b1d-2c3a4d5e6f70",
  path_to_study: "uploads/study_4013/CR000001.dcm",
  study_uid: "1.2.840.113619.2.110.4013",
  image_uid: "1.2.840.113619.2.110.4013.1.1",
  anatomical_region: "Поясничный отдел позвоночника",
  quality_class: 1,
  quality_prob: 0.87,
  violation_type: "Не выравнена ось позвоночника;Присутствуют посторонние предметы",
  processing_status: "Success",
  time_of_processing: 14,
  description:
    "Ось позвоночника отклонена от вертикали изображения. В зоне интереса обнаружен посторонний предмет.",
};
