/// <reference types="jest" />
import { PayloadTooLargeException } from '@nestjs/common';
import path from 'path';
import { strFromU8, unzipSync } from 'fflate';
import { MAX_FILE_SIZE_BYTES } from './storage/file-validation';
import { StudyRecord, StudyRepository, StudyStatus } from './types/study.types';
import { StudiesService } from './studies.service';

const file = {
  originalname: 'spine.dcm',
  mimetype: 'application/dicom',
  size: 8,
  buffer: Buffer.from('dicomimg'),
};

const validSpine = {
  quality_class: 0,
  violation_type: '',
  anatomical_region: 'Поясничный отдел позвоночника',
};

function sheetText(body: Buffer): string {
  const files = unzipSync(new Uint8Array(body));
  return strFromU8(files['xl/worksheets/sheet1.xml']);
}

function createService(analyze?: (input: unknown) => Promise<unknown>) {
  const store = new Map<string, StudyRecord>();
  const studies: StudyRepository = {
    save: jest.fn(async (study: StudyRecord) => {
      const copy: StudyRecord = {
        ...study,
        result: study.result ? { ...study.result } : null,
      };
      store.set(copy.id, copy);
      return copy;
    }),
    finishIfProcessing: jest.fn(async (study: StudyRecord) => {
      const current = store.get(study.id);
      if (!current || current.status !== StudyStatus.Processing) {
        return false;
      }
      const copy: StudyRecord = {
        ...study,
        result: study.result ? { ...study.result } : null,
      };
      store.set(copy.id, copy);
      return true;
    }),
    findById: jest.fn(async (id: string) => {
      const study = store.get(id);
      if (!study) {
        return null;
      }
      return {
        ...study,
        result: study.result ? { ...study.result } : null,
      };
    }),
    findAll: jest.fn(async (sessionId?: string) => {
      return [...store.values()]
        .filter(
          (study) => sessionId === undefined || study.sessionId === sessionId,
        )
        .map((study) => ({
          ...study,
          result: study.result ? { ...study.result } : null,
        }));
    }),
  };
  const mlClient = {
    analyze: jest.fn(
      analyze ??
        (async () => ({
          ...validSpine,
          quality_prob: 0.1,
        })),
    ),
  };
  const fileStorage = {
    save: jest.fn(async () => '/tmp/uploads/spine.dcm'),
    read: jest.fn(async (): Promise<Buffer | null> => null),
  };

  const service = new StudiesService(
    studies as never,
    mlClient as never,
    fileStorage as never,
  );
  return { service, mlClient, fileStorage };
}

async function waitForStatus(
  service: StudiesService,
  id: string,
  status: StudyStatus,
) {
  for (let i = 0; i < 30; i += 1) {
    const current = await service.getById(id);
    if (current.status === status) {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`status ${status} not reached`);
}

describe('StudiesService', () => {
  it('rejects missing file', async () => {
    const { service } = createService();
    await expect(service.create(undefined)).rejects.toMatchObject({
      response: { code: 'FILE_REQUIRED' },
    });
  });

  it('rejects empty file', async () => {
    const { service } = createService();
    await expect(
      service.create({
        ...file,
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({
      response: { code: 'FILE_REQUIRED' },
    });
  });

  it('rejects invalid file type', async () => {
    const { service } = createService();
    await expect(
      service.create({
        ...file,
        originalname: 'photo.png',
        mimetype: 'image/png',
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_FILE_TYPE' },
    });
  });

  it('rejects an oversized session id before storing the file', async () => {
    const { service, fileStorage } = createService();
    await expect(service.create(file, 'x'.repeat(129))).rejects.toMatchObject({
      response: { code: 'INVALID_SESSION_ID' },
    });
    expect(fileStorage.save).not.toHaveBeenCalled();
  });

  it('creates a study, runs mock analysis and returns result', async () => {
    const { service, mlClient, fileStorage } = createService();
    const created = await service.create(file);

    expect(created.status).toBe(StudyStatus.Processing);
    expect(created.sessionId).toBeNull();
    expect(created.id).toEqual(expect.any(String));
    expect(fileStorage.save).toHaveBeenCalled();

    await waitForStatus(service, created.id, StudyStatus.Completed);

    const status = await service.getById(created.id);
    expect(status.hasResult).toBe(true);
    expect(mlClient.analyze).toHaveBeenCalledWith({
      studyId: created.id,
      filePath: '/tmp/uploads/spine.dcm',
      originalFileName: 'spine.dcm',
    });

    const result = await service.getResult(created.id);
    expect(result.quality_class).toBe(0);
    expect(result.violation_type).toBe('');
    expect(result.studyId).toBe(created.id);
    expect(result.anatomical_region).toBe('Поясничный отдел позвоночника');
  });

  it('stores a blank session id as null', async () => {
    const { service } = createService();
    const created = await service.create(file, '   ');
    expect(created.sessionId).toBeNull();
    const status = await service.getById(created.id);
    expect(status.sessionId).toBeNull();
  });

  it('filters studies by session id and keeps every study in the unfiltered list', async () => {
    const { service } = createService();
    const first = await service.create(file, 'A');
    const second = await service.create(file, 'B');

    const onlyA = await service.list('A');
    expect(onlyA.items.map((item) => item.id)).toEqual([first.id]);

    const onlyB = await service.list('B');
    expect(onlyB.items.map((item) => item.id)).toEqual([second.id]);

    const all = await service.list();
    expect(all.items.map((item) => item.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it('returns an empty list when there are no studies', async () => {
    const { service } = createService();

    const result = await service.list();

    expect(result).toEqual({ items: [] });
  });

  it('returns RESULT_NOT_READY while analysis is still running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { service } = createService(async () => {
      await gate;
      return {
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      };
    });

    const created = await service.create(file);
    await expect(service.getResult(created.id)).rejects.toMatchObject({
      response: { code: 'RESULT_NOT_READY', status: StudyStatus.Processing },
    });

    release();
    await waitForStatus(service, created.id, StudyStatus.Completed);
  });

  it('marks study as error when ML fails', async () => {
    const { service } = createService(async () => {
      throw new Error('ml down');
    });
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);

    expect(status.error).toBe('Не удалось проверить качество укладки.');
    expect(status.hasResult).toBe(false);
    await expect(service.getResult(created.id)).rejects.toMatchObject({
      response: { code: 'ANALYSIS_FAILED' },
    });
  });

  it('returns not found for unknown study', async () => {
    const { service } = createService();
    const id = '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21';
    await expect(service.getById(id)).rejects.toMatchObject({
      response: { code: 'STUDY_NOT_FOUND' },
    });
    await expect(service.getResult(id)).rejects.toMatchObject({
      response: { code: 'STUDY_NOT_FOUND' },
    });
    await expect(service.getHeatmap(id)).rejects.toMatchObject({
      response: { code: 'STUDY_NOT_FOUND' },
    });
  });

  it('keeps a completed result when the heatmap file is missing', async () => {
    const { service, fileStorage } = createService();
    const created = await service.create(file);
    await waitForStatus(service, created.id, StudyStatus.Completed);

    await expect(service.getHeatmap(created.id)).rejects.toMatchObject({
      response: { code: 'HEATMAP_NOT_FOUND' },
    });
    expect(fileStorage.read).toHaveBeenCalledWith(
      path.join(path.dirname('/tmp/uploads/spine.dcm'), 'heatmap.png'),
    );

    const result = await service.getResult(created.id);
    expect(result.quality_class).toBe(0);
    expect(result.violation_type).toBe('');
  });

  it('returns heatmap bytes without changing the stored result', async () => {
    const { service, fileStorage } = createService();
    fileStorage.read.mockResolvedValue(Buffer.from('png-bytes'));
    const created = await service.create(file);
    await waitForStatus(service, created.id, StudyStatus.Completed);

    await expect(service.getHeatmap(created.id)).resolves.toEqual({
      body: Buffer.from('png-bytes'),
    });
    const result = await service.getResult(created.id);
    expect(result.quality_class).toBe(0);
    expect(result.anatomical_region).toBe('Поясничный отдел позвоночника');
  });

  it('marks study as error when ML returns missing quality_class', async () => {
    const { service } = createService(async () => ({
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error when ML returns unknown anatomical_region', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Неизвестный регион',
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error when ML returns invalid quality_prob', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
      quality_prob: 1.5,
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error when ML returns null quality_prob', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
      quality_prob: null,
    }));

    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);

    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error when violation does not match the region', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: 'Не выравнена ось позвоночника',
      anatomical_region: 'Проксимальный отдел бедра',
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error on repeated violations', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: 'Некорректная укладка;Некорректная укладка',
      anatomical_region: 'Поясничный отдел позвоночника',
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error for empty violation on class 1', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it('marks study as error for non-empty violation on class 0', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: 'Некорректная укладка',
      anatomical_region: 'Поясничный отдел позвоночника',
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
  });

  it.each([
    ['response is null', null],
    ['response is an array', []],
    [
      'quality_class is a string',
      {
        quality_class: '0',
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    ],
    [
      'quality_class is fractional',
      {
        quality_class: 0.5,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    ],
    [
      'quality_prob is below 0',
      {
        ...validSpine,
        quality_prob: -0.01,
      },
    ],
    [
      'quality_prob is not finite',
      {
        ...validSpine,
        quality_prob: Number.POSITIVE_INFINITY,
      },
    ],
    [
      'anatomical_region is missing',
      {
        quality_class: 0,
        violation_type: '',
      },
    ],
    [
      'violation has a space after the separator',
      {
        quality_class: 1,
        violation_type: 'Некорректная укладка; Не выравнена ось позвоночника',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    ],
    [
      'violation has an empty fragment',
      {
        quality_class: 1,
        violation_type: ';Некорректная укладка',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    ],
  ])('marks study as error when %s', async (_label, payload) => {
    const { service } = createService(async () => payload);
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);

    expect(status.error).toBe('Не удалось проверить качество укладки.');
    expect(status.hasResult).toBe(false);
    await expect(service.getResult(created.id)).rejects.toMatchObject({
      response: { code: 'ANALYSIS_FAILED', status: StudyStatus.Error },
    });
  });

  it('accepts a class 1 result and keeps the original violation string', async () => {
    const violationType =
      'Некорректная укладка;Не выравнена ось позвоночника';
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: violationType,
      anatomical_region: 'Поясничный отдел позвоночника',
      quality_prob: 1,
    }));
    const created = await service.create(file);
    await waitForStatus(service, created.id, StudyStatus.Completed);

    await expect(service.getResult(created.id)).resolves.toEqual({
      studyId: created.id,
      quality_class: 1,
      violation_type: violationType,
      anatomical_region: 'Поясничный отдел позвоночника',
      quality_prob: 1,
    });
  });

  it('accepts a hip result and omits quality_prob when ML does not send it', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: 'Некорректная укладка;Некорректная область интереса',
      anatomical_region: 'Проксимальный отдел бедра',
    }));
    const created = await service.create(file);
    await waitForStatus(service, created.id, StudyStatus.Completed);

    const result = await service.getResult(created.id);
    expect(result).toEqual({
      studyId: created.id,
      quality_class: 1,
      violation_type: 'Некорректная укладка;Некорректная область интереса',
      anatomical_region: 'Проксимальный отдел бедра',
    });
    expect(result.quality_prob).toBeUndefined();
  });

  it('accepts quality_prob at the lower bound', async () => {
    const { service } = createService(async () => ({
      ...validSpine,
      quality_prob: 0,
    }));
    const created = await service.create(file);
    await waitForStatus(service, created.id, StudyStatus.Completed);
    expect((await service.getResult(created.id)).quality_prob).toBe(0);
  });

  it('does not fail the other study when one ML call fails', async () => {
    const { service } = createService(async (input) => {
      if (
        typeof input === 'object' &&
        input !== null &&
        'originalFileName' in input &&
        input.originalFileName === 'bad.dcm'
      ) {
        throw new Error('ml down');
      }

      return validSpine;
    });

    const failed = await service.create({ ...file, originalname: 'bad.dcm' });
    const succeeded = await service.create(file);

    expect((await waitForStatus(service, failed.id, StudyStatus.Error)).error).toBe(
      'Не удалось проверить качество укладки.',
    );
    expect(
      (await waitForStatus(service, succeeded.id, StudyStatus.Completed)).hasResult,
    ).toBe(true);
  });

  it('rejects an oversized file before storing it', async () => {
    const { service, fileStorage } = createService();
    await expect(
      service.create({
        ...file,
        size: MAX_FILE_SIZE_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(fileStorage.save).not.toHaveBeenCalled();
  });

  it('rejects an empty buffer before storing the file', async () => {
    const { service, fileStorage } = createService();
    await expect(
      service.create({
        ...file,
        size: 8,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ response: { code: 'FILE_REQUIRED' } });
    expect(fileStorage.save).not.toHaveBeenCalled();
  });

  it('rejects an empty file before checking its type', async () => {
    const { service } = createService();
    await expect(
      service.create({
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ response: { code: 'FILE_REQUIRED' } });
  });

  it('rejects octet-stream without a dicom extension', async () => {
    const { service, fileStorage } = createService();
    await expect(
      service.create({
        ...file,
        originalname: 'study',
        mimetype: 'application/octet-stream',
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_FILE_TYPE' } });
    expect(fileStorage.save).not.toHaveBeenCalled();
  });

  it('trims session id and accepts exactly 128 characters', async () => {
    const { service } = createService();
    const sessionId = 'a'.repeat(128);
    const created = await service.create(file, `  ${sessionId}  `);
    expect(created.sessionId).toBe(sessionId);

    const listed = await service.list(`  ${sessionId}  `);
    expect(listed.items.map((item) => item.id)).toEqual([created.id]);
  });

  it('treats a whitespace session filter as the full history', async () => {
    const { service } = createService();
    const created = await service.create(file, 'A');
    const listed = await service.list('   ');
    expect(listed.items.map((item) => item.id)).toEqual([created.id]);
  });

  it('rejects a non-string session id before storing the file', async () => {
    const { service, fileStorage } = createService();
    await expect(service.create(file, 12)).rejects.toMatchObject({
      response: { code: 'INVALID_SESSION_ID' },
    });
    expect(fileStorage.save).not.toHaveBeenCalled();
    await expect(service.list({ id: 'A' })).rejects.toMatchObject({
      response: { code: 'INVALID_SESSION_ID' },
    });
  });

  it('creates a new study id on every upload', async () => {
    const { service } = createService();
    const first = await service.create(file);
    const second = await service.create(file);
    expect(first.id).not.toBe(second.id);
    expect(first.status).toBe(StudyStatus.Processing);
    expect(second.status).toBe(StudyStatus.Processing);
  });

  it('exports one completed study and an empty selection', async () => {
    const { service } = createService();
    const created = await service.create(file, 'session-a');
    await waitForStatus(service, created.id, StudyStatus.Completed);

    const one = await service.exportXlsx({ ids: created.id });
    expect(one.filename).toBe('bonecheck-spine.xlsx');
    expect(one.body.subarray(0, 2).toString()).toBe('PK');
    const oneSheet = sheetText(one.body);
    expect(oneSheet).toContain('spine.dcm');
    expect(oneSheet).toContain('Корректно');
    expect(oneSheet).toContain('10%');

    const empty = await service.exportXlsx({ session_id: 'nobody' });
    expect(empty.filename).toBe('bonecheck-history.xlsx');
    const emptySheet = sheetText(empty.body);
    expect(emptySheet).toContain('Файл');
    expect(emptySheet).not.toContain('spine.dcm');
    expect(emptySheet).not.toContain('<row r="2">');
  });

  it('exports several studies and rejects an unknown id', async () => {
    const { service } = createService();
    const first = await service.create(file);
    const second = await service.create({
      ...file,
      originalname: 'hip.dcm',
    });
    await waitForStatus(service, first.id, StudyStatus.Completed);
    await waitForStatus(service, second.id, StudyStatus.Completed);

    const many = await service.exportXlsx({ ids: `${second.id},${first.id}` });
    expect(many.filename).toBe('bonecheck-history.xlsx');
    const text = sheetText(many.body);
    expect(text.indexOf('hip.dcm')).toBeLessThan(text.indexOf('spine.dcm'));
    expect(text).toContain('spine.dcm');
    expect(text).toContain('hip.dcm');

    await expect(
      service.exportXlsx({ ids: '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21' }),
    ).rejects.toMatchObject({
      response: { code: 'STUDY_NOT_FOUND' },
    });
  });

  it('exports the TZ submission table with numeric quality_class', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: 'Некорректная укладка;Не выравнена ось позвоночника',
      anatomical_region: 'Поясничный отдел позвоночника',
      study_uid: '1.2.840.1',
      image_uid: '1.2.840.2',
      time_of_processing: 2.5,
      processing_status: 'Success',
      femur_side: 'L',
    }));
    const created = await service.create(file);
    await waitForStatus(service, created.id, StudyStatus.Completed);

    const xlsx = await service.exportSubmission({ ids: created.id });
    expect(xlsx.filename).toBe('bonecheck-submission.xlsx');
    const sheet = sheetText(xlsx.body);
    expect(sheet).toContain('path_to_study');
    expect(sheet).toContain('study_uid');
    expect(sheet).toContain('time_of_processing');
    expect(sheet).toContain('spine.dcm');
    expect(sheet).toContain('1.2.840.1');
    expect(sheet).toContain('1.2.840.2');
    expect(sheet).toContain('Некорректная укладка;Не выравнена ось позвоночника');
    expect(sheet).toContain('Success');
    expect(sheet).toContain('<v>1</v>');
    expect(sheet).toContain('<v>2.5</v>');
    expect(sheet).not.toContain('Корректно');
    expect(sheet).not.toContain('femur_side');

    const csv = await service.exportSubmission({ ids: created.id, format: 'csv' });
    expect(csv.filename).toBe('bonecheck-submission.csv');
    const text = csv.body.toString('utf8');
    expect(text.split('\r\n')[0]).toBe(
      'path_to_study,study_uid,image_uid,anatomical_region,quality_class,violation_type,processing_status,time_of_processing',
    );
    expect(text).toContain('spine.dcm,1.2.840.1,1.2.840.2,Поясничный отдел позвоночника,1,Некорректная укладка;Не выравнена ось позвоночника,Success,2.5');
  });
});
