import { MlPrediction } from '../ml/ml.types';

export enum StudyStatus {
  Uploaded = 'uploaded',
  Processing = 'processing',
  Completed = 'completed',
  Error = 'error',
}

export type StudyRecord = {
  id: string;
  status: StudyStatus;
  originalFileName: string;
  storedFilePath: string;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  result: MlPrediction | null;
  processingTime: number | null;
};

export const STUDY_REPOSITORY = Symbol('STUDY_REPOSITORY');

export interface StudyRepository {
  save(study: StudyRecord): Promise<StudyRecord>;
  findById(id: string): Promise<StudyRecord | null>;
  findAll(): Promise<StudyRecord[]>;
}
