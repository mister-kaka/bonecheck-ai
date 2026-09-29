/// <reference types="jest" />
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { HttpMlClient } from './http-ml.client';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

describe('HttpMlClient', () => {
  const originalFetch = global.fetch;
  let previousUrl: string | undefined;
  let previousTimeout: string | undefined;
  let directory: string;
  let input: {
    studyId: string;
    filePath: string;
    originalFileName: string;
  };

  beforeEach(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), 'bonecheck-ml-client-'));
    input = {
      studyId: '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21',
      filePath: path.join(directory, 'hip.dcm'),
      originalFileName: 'hip.dcm',
    };
    writeFileSync(input.filePath, Buffer.from('dicom-bytes'));
    previousUrl = process.env.ML_SERVICE_URL;
    previousTimeout = process.env.ML_TIMEOUT_MS;
    process.env.ML_SERVICE_URL = 'http://ml.test:8000';
    process.env.ML_TIMEOUT_MS = '180000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (previousUrl === undefined) {
      delete process.env.ML_SERVICE_URL;
    } else {
      process.env.ML_SERVICE_URL = previousUrl;
    }
    if (previousTimeout === undefined) {
      delete process.env.ML_TIMEOUT_MS;
    } else {
      process.env.ML_TIMEOUT_MS = previousTimeout;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('sends the dicom bytes and keeps only the site result', async () => {
    const fetchMock = jest.fn(async () =>
      Response.json({
        quality_class: 1,
        violation_type: 'Некорректная укладка',
        anatomical_region: 'Проксимальный отдел бедра',
        quality_prob: 0.77,
        femur_side: 'R',
        femur_lay_score: 0.4,
        heatmap_png: png.toString('base64'),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new HttpMlClient().analyze(input);

    expect(result.prediction).toEqual({
      quality_class: 1,
      violation_type: 'Некорректная укладка',
      anatomical_region: 'Проксимальный отдел бедра',
    });
    expect(result.prediction).not.toHaveProperty('quality_prob');
    expect(result.prediction).not.toHaveProperty('femur_side');
    expect(result.prediction).not.toHaveProperty('heatmap_png');
    expect(result.heatmapPng).toEqual(png);

    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ml.test:8000/analyze');
    expect(request.method).toBe('POST');
    expect(request.headers).toBeUndefined();
    expect(request.body).toBeInstanceOf(FormData);
    const part = (request.body as FormData).get('file');
    expect(part).toBeInstanceOf(Blob);
    expect(Buffer.from(await (part as Blob).arrayBuffer())).toEqual(Buffer.from('dicom-bytes'));
    expect((part as File).name).toBe('study.dcm');
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps DICOM identifiers and processing time from the ML response', async () => {
    global.fetch = jest.fn(async () =>
      Response.json({
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
        study_uid: '1.2.3',
        image_uid: '1.2.3.4',
        time_of_processing: 1.25,
        processing_status: 'Success',
        femur_side: 'L',
      }),
    ) as unknown as typeof fetch;

    const result = await new HttpMlClient().analyze(input);

    expect(result).toEqual({
      prediction: {
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
        study_uid: '1.2.3',
        image_uid: '1.2.3.4',
        time_of_processing: 1.25,
        processing_status: 'Success',
      },
      heatmapPng: null,
    });
    expect(result.prediction).not.toHaveProperty('femur_side');
  });

  it('keeps the prediction when heatmap_png is not a png', async () => {
    global.fetch = jest.fn(async () =>
      Response.json({
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
        heatmap_png: '!!!!',
      }),
    ) as unknown as typeof fetch;

    const result = await new HttpMlClient().analyze(input);

    expect(result.heatmapPng).toBeNull();
    expect(result.prediction).toEqual({
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
    });
  });

  it('rejects a transport failure without throwing outside the client', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;

    await expect(new HttpMlClient().analyze(input)).rejects.toThrow(
      'ML service unavailable',
    );
  });

  it('rejects an inference error from the service', async () => {
    global.fetch = jest.fn(async () =>
      Response.json({ error: 'RuntimeError: bad dicom' }, { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(new HttpMlClient().analyze(input)).rejects.toThrow('bad dicom');
  });

  it('rejects an unreadable dicom before calling ML', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new HttpMlClient().analyze({
        ...input,
        filePath: path.join(directory, 'missing.dcm'),
      }),
    ).rejects.toThrow('DICOM is unreadable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
