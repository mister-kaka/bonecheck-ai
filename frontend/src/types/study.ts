/*  Общие типы исследований (пока используются мок-данными)  */

/** Допустимые анатомические регионы (docs/task-analysis.md) */
export type AnatomicalRegion =
  | "Поясничный отдел позвоночника"
  | "Проксимальный отдел бедра";

/** 0 — корректное изображение, 1 — нарушение качества */
export type QualityClass = 0 | 1;

/** Статус обработки исследования */
export type ProcessingStatus = "Success" | "Failure";

/** Строка таблицы истории */
export interface HistoryItem {
  id: string;
  /** ISO-дата, например "2026-09-18T11:21:00.000Z" */
  date: string;
  uid: string;
  region: AnatomicalRegion;
  status: ProcessingStatus;
  /** null, если обработка завершилась ошибкой */
  quality_class: QualityClass | null;
}

/** Результат анализа одного изображения */
export interface StudyResult {
  id: string;
  path_to_study: string;
  study_uid: string;
  image_uid: string;
  anatomical_region: AnatomicalRegion;
  quality_class: QualityClass;
  /** Вероятность нарушения в диапазоне [0; 1] */
  quality_prob: number;
  /** Типы нарушений через «;», пустая строка — нарушений нет */
  violation_type: string;
  processing_status: ProcessingStatus;
  /** Время обработки, секунды */
  time_of_processing: number;
  description: string;
}

/** Опция для Select */
export interface SelectOption {
  value: string;
  label: string;
}
