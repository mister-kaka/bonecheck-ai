export type StudyStatus = "uploaded" | "processing" | "completed" | "error";

export type AnatomicalRegion =
  | "Поясничный отдел позвоночника"
  | "Проксимальный отдел бедра";

export type QualityClass = 0 | 1;

export interface StudyListItem {
  id: string;
  sessionId: string | null;
  status: StudyStatus;
  originalFileName: string;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  hasResult: boolean;
}

export interface StudyResultPayload {
  studyId: string;
  quality_class: QualityClass;
  violation_type: string;
  anatomical_region: AnatomicalRegion;
  quality_prob?: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export type PackageStudyItem = {
  id: string;
  fileName: string;
  status: StudyStatus;
  error: string | null;
  layoutLabel: string | null;
};
