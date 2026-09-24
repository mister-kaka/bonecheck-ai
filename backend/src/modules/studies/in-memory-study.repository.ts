import { Injectable } from '@nestjs/common';
import { StudyRecord, StudyRepository } from './study.types';

@Injectable()
export class InMemoryStudyRepository implements StudyRepository {
  private readonly studies = new Map<string, StudyRecord>();

  async save(study: StudyRecord): Promise<StudyRecord> {
    const copy: StudyRecord = {
      ...study,
      result: study.result ? { ...study.result } : null,
    };
    this.studies.set(copy.id, copy);
    return copy;
  }

  async findById(id: string): Promise<StudyRecord | null> {
    const study = this.studies.get(id);
    if (!study) {
      return null;
    }

    return {
      ...study,
      result: study.result ? { ...study.result } : null,
    };
  }

  async findAll(): Promise<StudyRecord[]> {
    const allStudies = Array.from(this.studies.values());
    return allStudies.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).map(study => ({
      ...study,
      result: study.result ? { ...study.result } : null,
    }));
  }
}
