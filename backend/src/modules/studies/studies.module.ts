import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { InMemoryStudyRepository } from './in-memory-study.repository';
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
    InMemoryStudyRepository,
    {
      provide: STUDY_REPOSITORY,
      useExisting: InMemoryStudyRepository,
    },
  ],
})
export class StudiesModule {}
