import { Module } from '@nestjs/common';
import { FileStorageService } from './storage/file-storage.service';
import { SqliteStudyRepository } from './persistence/sqlite-study.repository';
import { StudiesController } from './studies.controller';
import { StudiesService } from './studies.service';
import { STUDY_REPOSITORY } from './types/study.types';
import { MlModule } from '../ml/ml.module';

@Module({
  imports: [MlModule],
  controllers: [StudiesController],
  providers: [
    StudiesService,
    FileStorageService,
    SqliteStudyRepository,
    {
      provide: STUDY_REPOSITORY,
      useExisting: SqliteStudyRepository,
    },
  ],
})
export class StudiesModule {}
