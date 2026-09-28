import { Module } from '@nestjs/common';
import { ML_CLIENT } from './ml.types';
import { MockMlClient } from './mock-ml.client';

// Пока ML-сервис не подключён, ML_CLIENT - это MockMlClient в том же процессе.
@Module({
  providers: [
    MockMlClient,
    {
      provide: ML_CLIENT,
      useExisting: MockMlClient,
    },
  ],
  exports: [ML_CLIENT],
})
export class MlModule {}
