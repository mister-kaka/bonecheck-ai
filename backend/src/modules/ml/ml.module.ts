import { Module } from '@nestjs/common';
import { HttpMlClient } from './http-ml.client';
import { ML_CLIENT } from './ml.types';
import { MockMlClient } from './mock-ml.client';

// ML_CLIENT=http - сервис по ML_SERVICE_URL. ML_CLIENT=mock - заглушка.
// Без переменной: заглушка на Render (RENDER=true), иначе HTTP.
export function selectMlClient<T>(
  mockClient: T,
  httpClient: T,
  env: NodeJS.ProcessEnv = process.env,
): T {
  const mode = env.ML_CLIENT?.trim();
  if (mode === 'http') {
    return httpClient;
  }
  if (mode === 'mock' || env.RENDER === 'true') {
    return mockClient;
  }
  return httpClient;
}

@Module({
  providers: [
    MockMlClient,
    HttpMlClient,
    {
      provide: ML_CLIENT,
      useFactory: (mockClient: MockMlClient, httpClient: HttpMlClient) =>
        selectMlClient(mockClient, httpClient),
      inject: [MockMlClient, HttpMlClient],
    },
  ],
  exports: [ML_CLIENT],
})
export class MlModule {}
