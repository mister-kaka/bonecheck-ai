/// <reference types="jest" />
import { Test } from '@nestjs/testing';
import { HttpMlClient } from './http-ml.client';
import { MlModule, selectMlClient } from './ml.module';
import { ML_CLIENT } from './ml.types';
import { MockMlClient } from './mock-ml.client';

describe('selectMlClient', () => {
  const mockClient = { kind: 'mock' };
  const httpClient = { kind: 'http' };

  it('uses HTTP when ML_CLIENT is unset and the process is not on Render', () => {
    expect(selectMlClient(mockClient, httpClient, {})).toBe(httpClient);
  });

  it('uses the mock when ML_CLIENT=mock', () => {
    expect(selectMlClient(mockClient, httpClient, { ML_CLIENT: 'mock' })).toBe(mockClient);
  });

  it('uses the mock on Render unless ML_CLIENT=http', () => {
    expect(selectMlClient(mockClient, httpClient, { RENDER: 'true' })).toBe(mockClient);
    expect(
      selectMlClient(mockClient, httpClient, { RENDER: 'true', ML_CLIENT: 'http' }),
    ).toBe(httpClient);
  });
});

describe('MlModule', () => {
  const previousClient = process.env.ML_CLIENT;
  const previousRender = process.env.RENDER;

  afterEach(() => {
    restoreEnv('ML_CLIENT', previousClient);
    restoreEnv('RENDER', previousRender);
  });

  it('wires the HTTP client by default', async () => {
    delete process.env.ML_CLIENT;
    delete process.env.RENDER;
    const moduleRef = await Test.createTestingModule({
      imports: [MlModule],
    }).compile();

    expect(moduleRef.get(ML_CLIENT)).toBeInstanceOf(HttpMlClient);
    await moduleRef.close();
  });

  it('wires the mock client when ML_CLIENT=mock', async () => {
    process.env.ML_CLIENT = 'mock';
    delete process.env.RENDER;
    const moduleRef = await Test.createTestingModule({
      imports: [MlModule],
    }).compile();

    expect(moduleRef.get(ML_CLIENT)).toBeInstanceOf(MockMlClient);
    await moduleRef.close();
  });

  it('wires the mock client on Render', async () => {
    delete process.env.ML_CLIENT;
    process.env.RENDER = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [MlModule],
    }).compile();

    expect(moduleRef.get(ML_CLIENT)).toBeInstanceOf(MockMlClient);
    await moduleRef.close();
  });
});

function restoreEnv(name: 'ML_CLIENT' | 'RENDER', previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}
