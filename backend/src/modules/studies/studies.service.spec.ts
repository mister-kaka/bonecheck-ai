/// <reference types="jest" />
import { StudyRecord, StudyRepository, StudyStatus } from './study.types';
import { StudiesService } from './studies.service';

const file = {
  originalname: 'spine.dcm',
  mimetype: 'application/dicom',
  size: 8,
  buffer: Buffer.from('dicomimg'),
};

function createService(analyze?: () => Promise<unknown>) {
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
        .filter((study) => sessionId === undefined || study.sessionId === sessionId)
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
          quality_class: 0,
          violation_type: '',
          quality_prob: 0.1,
          anatomical_region: 'Поясничный отдел позвоночника', // Добавлено для успешного прохождения валидации
        })),
    ),
  };
  const fileStorage = {
    save: jest.fn(async () => '/tmp/uploads/spine.dcm'),
  };

  const service = new StudiesService(studies as never, mlClient as never, fileStorage as never);
  return { service, mlClient, fileStorage };
}

async function waitForStatus(service: StudiesService, id: string, status: StudyStatus) {
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
    expect(all.items.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
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
        anatomical_region: 'Поясничный отдел позвоночника' 
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

    expect(status.error).toBe('Ошибка обработки ML.');
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
  });

  // НОВЫЕ ТЕСТЫ ВАЛИДАЦИИ

  it('marks study as error when ML returns missing quality_class', async () => {
    const { service } = createService(async () => ({
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника'
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });

  it('marks study as error when ML returns unknown anatomical_region', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Неизвестный регион'
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });

  it('marks study as error when ML returns invalid quality_prob', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
      quality_prob: 1.5 // > 1
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });

  it('marks study as error when violation does not match the region', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: 'Не выравнена ось позвоночника', // spine violation
      anatomical_region: 'Проксимальный отдел бедра'    // hip region
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });

  it('marks study as error on repeated violations', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: 'Некорректная укладка;Некорректная укладка',
      anatomical_region: 'Поясничный отдел позвоночника'
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });

  it('marks study as error for empty violation on class 1', async () => {
    const { service } = createService(async () => ({
      quality_class: 1,
      violation_type: '', // Empty but class is 1
      anatomical_region: 'Поясничный отдел позвоночника'
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });

  it('marks study as error for non-empty violation on class 0', async () => {
    const { service } = createService(async () => ({
      quality_class: 0,
      violation_type: 'Некорректная укладка', // Non-empty but class is 0
      anatomical_region: 'Поясничный отдел позвоночника'
    }));
    const created = await service.create(file);
    const status = await waitForStatus(service, created.id, StudyStatus.Error);
    expect(status.error).toBe('Ошибка обработки ML.');
  });
});