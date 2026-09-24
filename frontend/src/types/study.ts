export type AnatomicalRegion =
  | "Поясничный отдел позвоночника"
  | "Проксимальный отдел бедра";

export type QualityClass = 0 | 1;

export type ProcessingStatus = "Success" | "Failure";

export interface HistoryItem {
  id: string;
  date: string;
  uid: string;
  region: AnatomicalRegion;
  status: ProcessingStatus;
  quality_class: QualityClass | null;
}

export interface StudyResult {
  id: string;
  path_to_study: string;
  study_uid: string;
  image_uid: string;
  anatomical_region: AnatomicalRegion;
  quality_class: QualityClass;
  quality_prob: number;
  violation_type: string;
  processing_status: ProcessingStatus;
  time_of_processing: number;
  description: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
