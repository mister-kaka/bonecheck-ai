/// <reference types="jest" />
import path from 'path';
import { HttpMlClient } from './http-ml.client';

const input = {
  studyId: '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21',
  filePath: path.join('C:\\data\\uploads', 'study', 'hip.dcm'),
  originalFileName: 'hip.dcm',
};

describe('HttpMlClient', () => {
  const originalFetch = global.fetch;
  let previousUrl: string | undefined;

  beforeEach(() => {
    previousUrl = process.env.ML_SERVICE_URL;
    process.env.ML_SERVICE_URL = 'http://ml.test:8000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (previousUrl === undefined) {
      delete process.env.ML_SERVICE_URL;
    } else {
      process.env.ML_SERVICE_URL = previousUrl;
    }
  });

  it('sends the stored dicom path and keeps only the site result', async () => {
    const fetchMock = jest.fn(async () =>
      Response.json({
        quality_class: 1,
        violation_type: 'Некорректная укладка',
        anatomical_region: 'Проксимальный отдел бедра',
        quality_prob: 0.77,
        femur_side: 'R',
        femur_lay_score: 0.4,
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new HttpMlClient().analyze(input);

    expect(result).toEqual({
      quality_class: 1,
      violation_type: 'Некорректная укладка',
      anatomical_region: 'Проксимальный отдел бедра',
    });
    expect(result).not.toHaveProperty('quality_prob');
    expect(result).not.toHaveProperty('femur_side');

    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ml.test:8000/analyze');
    expect(JSON.parse(String(request.body))).toEqual({
      dicom_path: input.filePath,
      heatmap_path: path.join('C:\\data\\uploads', 'study', 'heatmap.png'),
    });
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
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
      study_uid: '1.2.3',
      image_uid: '1.2.3.4',
      time_of_processing: 1.25,
      processing_status: 'Success',
    });
    expect(result).not.toHaveProperty('femur_side');
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
});
