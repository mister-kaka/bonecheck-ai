/// <reference types="jest" />
import { Test } from '@nestjs/testing';
import { HttpMlClient } from './http-ml.client';
import { MlModule } from './ml.module';
import { ML_CLIENT } from './ml.types';
import { MockMlClient } from './mock-ml.client';

describe('MlModule', () => {
  const previous = process.env.ML_CLIENT;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.ML_CLIENT;
    } else {
      process.env.ML_CLIENT = previous;
    }
  });

  it('wires the HTTP client by default', async () => {
    delete process.env.ML_CLIENT;
    const moduleRef = await Test.createTestingModule({
      imports: [MlModule],
    }).compile();

    expect(moduleRef.get(ML_CLIENT)).toBeInstanceOf(HttpMlClient);
    await moduleRef.close();
  });

  it('wires the mock client only when ML_CLIENT=mock', async () => {
    process.env.ML_CLIENT = 'mock';
    const moduleRef = await Test.createTestingModule({
      imports: [MlModule],
    }).compile();

    expect(moduleRef.get(ML_CLIENT)).toBeInstanceOf(MockMlClient);
    await moduleRef.close();
  });
});
