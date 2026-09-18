export type QualityClass = 0 | 1;

export type MlPrediction = {
  quality_class: QualityClass;
  violation_type: string;
  quality_prob?: number;
  anatomical_region?: string;
};

export type MlAnalyzeInput = {
  studyId: string;
  filePath: string;
  originalFileName: string;
};

export interface MlClient {
  analyze(input: MlAnalyzeInput): Promise<MlPrediction>;
}

export const ML_CLIENT = Symbol('ML_CLIENT');
