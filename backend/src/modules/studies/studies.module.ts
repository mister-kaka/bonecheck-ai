import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { SqliteStudyRepository } from './sqlite-study.repository';
import { StudiesController } from './studies.controller';
import { StudiesService } from './studies.service';
import { STUDY_REPOSITORY } from './study.types';
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
