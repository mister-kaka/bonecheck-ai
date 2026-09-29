import { Module } from '@nestjs/common';
import { HttpMlClient } from './http-ml.client';
import { ML_CLIENT } from './ml.types';
import { MockMlClient } from './mock-ml.client';

// Рабочий путь — HttpMlClient. MockMlClient остаётся только для тестов: ML_CLIENT=mock.
@Module({
  providers: [
    MockMlClient,
    HttpMlClient,
    {
      provide: ML_CLIENT,
      useFactory: (mockClient: MockMlClient, httpClient: HttpMlClient) => {
        if (process.env.ML_CLIENT === 'mock') {
          return mockClient;
        }
        return httpClient;
      },
      inject: [MockMlClient, HttpMlClient],
    },
  ],
  exports: [ML_CLIENT],
})
export class MlModule {}
