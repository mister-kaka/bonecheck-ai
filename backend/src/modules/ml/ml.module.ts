import { Module } from '@nestjs/common';
import { ML_CLIENT } from './ml.types';
import { MockMlClient } from './mock-ml.client';

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
