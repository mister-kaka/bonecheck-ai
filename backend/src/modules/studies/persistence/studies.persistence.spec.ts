/// <reference types="jest" />
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { MockMlClient } from '../../ml/mock-ml.client';
import { MlClient } from '../../ml/ml.types';
import { SqliteStudyRepository } from './sqlite-study.repository';
import { StudiesService } from '../studies.service';
import { StudyRecord, StudyStatus } from '../types/study.types';

const file = {
  originalname: 'spine.dcm',
  mimetype: 'application/dicom',
  size: 8,
  buffer: Buffer.from('dicomimg'),
};

type StudySqlRow = {
  id: string;
  session_id: string | null;
  status: string;
  original_file_name: string;
  quality_class: number | null;
  quality_prob: number | null;
  violation_type: string | null;
  anatomical_region: string | null;
  error: string | null;
};

describe('study persistence (sqlite)', () => {
  let directory: string;
  let previousDatabasePath: string | undefined;
  let previousDelay: string | undefined;
  const repositories: SqliteStudyRepository[] = [];

  beforeEach(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), 'bonecheck-sqlite-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    previousDelay = process.env.ML_MOCK_DELAY_MS;
    process.env.DATABASE_PATH = path.join(directory, 'bonecheck.sqlite');
    process.env.ML_MOCK_DELAY_MS = '0';
  });

  afterEach(() => {
    for (const repository of repositories) {
      repository.onModuleDestroy();
    }
    repositories.length = 0;

    if (previousDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previousDatabasePath;
    }

    if (previousDelay === undefined) {
      delete process.env.ML_MOCK_DELAY_MS;
    } else {
      process.env.ML_MOCK_DELAY_MS = previousDelay;
    }

    rmSync(directory, { recursive: true, force: true });
  });

  function openService(client?: MlClient) {
    const repository = new SqliteStudyRepository();
    repositories.push(repository);
    const service = new StudiesService(
      repository,
      (client ?? new MockMlClient()) as never,
      {
        save: async () => path.join(directory, 'spine.dcm'),
      } as never,
    );
    return { repository, service };
  }

  function readRow(id: string): StudySqlRow | undefined {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
      throw new Error('DATABASE_PATH is not set');
    }

    const db = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      return db.prepare('SELECT * FROM studies WHERE id = ?').get(id) as
        StudySqlRow | undefined;
    } finally {
      db.close();
    }
  }

  function readIds(): string[] {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
      throw new Error('DATABASE_PATH is not set');
    }

    const db = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      const rows = db.prepare('SELECT id FROM studies').all() as Array<{
        id: string;
      }>;
      return rows.map((row) => row.id);
    } finally {
      db.close();
    }
  }

  async function waitForStatus(
    service: StudiesService,
    id: string,
    status: StudyStatus,
  ) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const current = await service.getById(id);
      if (current.status === status) {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(`status ${status} not reached`);
  }

  it('creates the studies table on startup', () => {
    openService();
    const databasePath = process.env.DATABASE_PATH as string;
    const db = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      const table = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'studies'",
        )
        .get() as { name: string } | undefined;
      expect(table?.name).toBe('studies');
    } finally {
      db.close();
    }
  });

  it('writes a study and its ML result into sqlite', async () => {
    const { service } = openService();
    const created = await service.create(file, 'A');
    await waitForStatus(service, created.id, StudyStatus.Completed);

    const row = readRow(created.id);
    expect(row).toMatchObject({
      id: created.id,
      session_id: 'A',
      status: 'completed',
      original_file_name: 'spine.dcm',
      quality_class: 0,
      quality_prob: null,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
      error: null,
    });
    expect(readIds()).toEqual([created.id]);

    const result = await service.getResult(created.id);
    expect(result).toEqual({
      studyId: created.id,
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
    });
    expect(result).not.toHaveProperty('quality_prob');
  });

  it('keeps an ML error in sqlite and exposes it through the existing API', async () => {
    const { service } = openService({
      analyze: async () => {
        throw new Error('ml down');
      },
    });
    const created = await service.create(file, 'A');
    await waitForStatus(service, created.id, StudyStatus.Error);

    const row = readRow(created.id);
    expect(row?.status).toBe('error');
    expect(row?.error).toBe('Не удалось проверить качество укладки.');
    expect(row?.quality_class).toBeNull();
    expect(row?.quality_prob).toBeNull();
    expect(row?.violation_type).toBeNull();
    expect(row?.anatomical_region).toBeNull();

    await expect(service.getResult(created.id)).rejects.toMatchObject({
      response: { code: 'ANALYSIS_FAILED', status: StudyStatus.Error },
    });
  });

  it('hides session A from the session B filter and returns both without a filter', async () => {
    const { service } = openService();
    const studyA = await service.create(file, 'A');
    const studyB = await service.create(
      { ...file, originalname: 'hip.dcm' },
      'B',
    );

    const onlyB = await service.list('B');
    expect(onlyB.items.map((item) => item.id)).toEqual([studyB.id]);
    expect(onlyB.items.map((item) => item.id)).not.toContain(studyA.id);

    const all = await service.list();
    expect(all.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([studyA.id, studyB.id]),
    );
    expect(all.items).toHaveLength(2);

    const rawA = readRow(studyA.id);
    const rawB = readRow(studyB.id);
    expect(rawA?.session_id).toBe('A');
    expect(rawB?.session_id).toBe('B');
  });

  it('returns the same study and result after the repository is closed and reopened', async () => {
    const first = openService();
    const created = await first.service.create(file, 'A');
    await waitForStatus(first.service, created.id, StudyStatus.Completed);
    const resultBefore = await first.service.getResult(created.id);
    first.repository.onModuleDestroy();

    const second = openService();
    const status = await second.service.getById(created.id);
    const resultAfter = await second.service.getResult(created.id);

    expect(status).toMatchObject({
      id: created.id,
      sessionId: 'A',
      status: StudyStatus.Completed,
      originalFileName: 'spine.dcm',
      hasResult: true,
      error: null,
    });
    expect(resultAfter).toEqual(resultBefore);
  });

  it('does not reprocess a completed study after backend restart', async () => {
    const first = openService();

    const created = await first.service.create(file, 'A');
    await waitForStatus(first.service, created.id, StudyStatus.Completed);

    first.repository.onModuleDestroy();

    const analyze = jest.fn().mockResolvedValue({
      quality_class: 0,
      violation_type: '',
      quality_prob: 0.05,
      anatomical_region: 'Поясничный отдел позвоночника',
    });

    const second = openService({ analyze });

    await second.service.onModuleInit();

    const status = await second.service.getById(created.id);
    const result = await second.service.getResult(created.id);

    expect(status.status).toBe(StudyStatus.Completed);
    expect(status.hasResult).toBe(true);
    expect(result.quality_class).toBe(0);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('does not reprocess an error study after backend restart', async () => {
    const first = openService({
      analyze: async () => {
        throw new Error('ml down');
      },
    });

    const created = await first.service.create(file, 'A');
    await waitForStatus(first.service, created.id, StudyStatus.Error);

    first.repository.onModuleDestroy();

    const analyze = jest.fn().mockResolvedValue({
      quality_class: 0,
      violation_type: '',
      quality_prob: 0.05,
      anatomical_region: 'Поясничный отдел позвоночника',
    });

    const second = openService({ analyze });

    await second.service.onModuleInit();

    const status = await second.service.getById(created.id);

    expect(status.status).toBe(StudyStatus.Error);
    expect(status.hasResult).toBe(false);
    expect(status.error).toBe('Не удалось проверить качество укладки.');

    await expect(second.service.getResult(created.id)).rejects.toMatchObject({
      response: {
        code: 'ANALYSIS_FAILED',
        status: StudyStatus.Error,
      },
    });

    expect(analyze).not.toHaveBeenCalled();
  });

  it('finishes a processing study after the backend starts again', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = openService({
      analyze: async () => {
        await gate;
        return {
          quality_class: 0,
          violation_type: '',
          quality_prob: 0.05,
          anatomical_region: 'Поясничный отдел позвоночника',
        };
      },
    });
    const created = await first.service.create(file, 'A');
    expect((await first.service.getById(created.id)).status).toBe(
      StudyStatus.Processing,
    );
    first.repository.onModuleDestroy();

    const second = openService();
    await second.service.onModuleInit();
    const status = await waitForStatus(
      second.service,
      created.id,
      StudyStatus.Completed,
    );
    expect(status.sessionId).toBe('A');
    expect(status.hasResult).toBe(true);

    release();
    const result = await second.service.getResult(created.id);
    expect(result.quality_class).toBe(0);
    expect(result.violation_type).toBe('');
  });

  function insertRow(values: Record<string, string | number | null>): void {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
      throw new Error('DATABASE_PATH is not set');
    }

    const db = new Database(databasePath);
    try {
      db.prepare(
        `INSERT INTO studies (
          id, session_id, status, original_file_name, stored_file_path,
          created_at, updated_at, error, quality_class, quality_prob,
          violation_type, anatomical_region
        ) VALUES (
          @id, @session_id, @status, @original_file_name, @stored_file_path,
          @created_at, @updated_at, @error, @quality_class, @quality_prob,
          @violation_type, @anatomical_region
        )`,
      ).run(values);
    } finally {
      db.close();
    }
  }

  it('stores an invalid ML response as error and does not retry it after restart', async () => {
    const first = openService({
      analyze: async () => ({
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Другой регион',
      }),
    });
    const created = await first.service.create(file, 'A');
    await waitForStatus(first.service, created.id, StudyStatus.Error);

    expect(readRow(created.id)).toMatchObject({
      status: 'error',
      error: 'Не удалось проверить качество укладки.',
      quality_class: null,
      quality_prob: null,
      violation_type: null,
      anatomical_region: null,
    });

    first.repository.onModuleDestroy();

    const analyze = jest.fn().mockResolvedValue({
      quality_class: 0,
      violation_type: '',
      quality_prob: 0.05,
      anatomical_region: 'Поясничный отдел позвоночника',
    });
    const second = openService({ analyze });
    await second.service.onModuleInit();

    const status = await second.service.getById(created.id);
    expect(status.status).toBe(StudyStatus.Error);
    expect(status.hasResult).toBe(false);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('does not expose a completed row whose result fails business validation', async () => {
    const { repository, service } = openService();
    const id = '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21';
    const record: StudyRecord = {
      id,
      sessionId: 'A',
      status: StudyStatus.Completed,
      originalFileName: 'spine.dcm',
      storedFilePath: path.join(directory, 'spine.dcm'),
      createdAt: '2026-09-18T11:21:00.000Z',
      updatedAt: '2026-09-18T11:21:01.000Z',
      error: null,
      result: {
        quality_class: 0,
        violation_type: 'Некорректная укладка',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    };

    await repository.save(record);

    const status = await service.getById(id);
    expect(status.status).toBe(StudyStatus.Completed);
    expect(status.hasResult).toBe(false);
    await expect(service.getResult(id)).rejects.toMatchObject({
      response: { code: 'RESULT_NOT_READY', status: StudyStatus.Completed },
    });
  });

  it('does not invent a result when violation_type is null', async () => {
    const { service } = openService();
    const id = '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b22';
    insertRow({
      id,
      session_id: null,
      status: 'completed',
      original_file_name: 'spine.dcm',
      stored_file_path: path.join(directory, 'spine.dcm'),
      created_at: '2026-09-18T11:21:00.000Z',
      updated_at: '2026-09-18T11:21:01.000Z',
      error: null,
      quality_class: 0,
      quality_prob: null,
      violation_type: null,
      anatomical_region: 'Поясничный отдел позвоночника',
    });

    const status = await service.getById(id);
    expect(status.hasResult).toBe(false);
    await expect(service.getResult(id)).rejects.toMatchObject({
      response: { code: 'RESULT_NOT_READY' },
    });
  });

  it('does not return stored result columns when status is error', async () => {
    const { service } = openService();
    const id = '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b23';
    insertRow({
      id,
      session_id: 'A',
      status: 'error',
      original_file_name: 'spine.dcm',
      stored_file_path: path.join(directory, 'spine.dcm'),
      created_at: '2026-09-18T11:21:00.000Z',
      updated_at: '2026-09-18T11:21:01.000Z',
      error: 'Не удалось проверить качество укладки.',
      quality_class: 0,
      quality_prob: 0.05,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
    });

    const status = await service.getById(id);
    expect(status.status).toBe(StudyStatus.Error);
    expect(status.hasResult).toBe(false);
    expect(status.error).toBe('Не удалось проверить качество укладки.');
    await expect(service.getResult(id)).rejects.toMatchObject({
      response: { code: 'ANALYSIS_FAILED', status: StudyStatus.Error },
    });
  });

  it('omits quality_prob in the API when the column is null', async () => {
    const { service } = openService({
      analyze: async () => ({
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      }),
    });
    const created = await service.create(file, 'A');
    await waitForStatus(service, created.id, StudyStatus.Completed);

    expect(readRow(created.id)?.quality_prob).toBeNull();
    const result = await service.getResult(created.id);
    expect(result.anatomical_region).toBe('Поясничный отдел позвоночника');
    expect(result).not.toHaveProperty('quality_prob');
  });

  it('keeps quality_prob 0', async () => {
    const { service } = openService({
      analyze: async () => ({
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Проксимальный отдел бедра',
        quality_prob: 0,
      }),
    });
    const created = await service.create(file, 'A');
    await waitForStatus(service, created.id, StudyStatus.Completed);

    expect(readRow(created.id)?.quality_prob).toBe(0);
    expect((await service.getResult(created.id)).quality_prob).toBe(0);
  });

  it('orders history by created_at desc and then id desc', async () => {
    const { repository, service } = openService();
    const sameTime = '2026-09-18T11:00:00.000Z';
    const later = '2026-09-18T12:00:00.000Z';
    const base = {
      sessionId: null,
      status: StudyStatus.Completed,
      originalFileName: 'spine.dcm',
      storedFilePath: path.join(directory, 'spine.dcm'),
      error: null,
      result: {
        quality_class: 0 as const,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    };

    await repository.save({
      ...base,
      id: 'id-a',
      createdAt: sameTime,
      updatedAt: sameTime,
    });
    await repository.save({
      ...base,
      id: 'id-c',
      createdAt: later,
      updatedAt: later,
    });
    await repository.save({
      ...base,
      id: 'id-b',
      createdAt: sameTime,
      updatedAt: sameTime,
    });

    const items = await service.list();
    expect(items.items.map((item) => item.id)).toEqual(['id-c', 'id-b', 'id-a']);
    expect(items.items[0]).not.toHaveProperty('quality_class');
  });

  it('does not overwrite a finished study when a second processing result arrives', async () => {
    const { repository } = openService();
    const id = '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b24';
    const createdAt = '2026-09-18T11:21:00.000Z';
    await repository.save({
      id,
      sessionId: null,
      status: StudyStatus.Processing,
      originalFileName: 'spine.dcm',
      storedFilePath: path.join(directory, 'spine.dcm'),
      createdAt,
      updatedAt: createdAt,
      error: null,
      result: null,
    });

    const completed = await repository.finishIfProcessing({
      id,
      sessionId: null,
      status: StudyStatus.Completed,
      originalFileName: 'spine.dcm',
      storedFilePath: path.join(directory, 'spine.dcm'),
      createdAt,
      updatedAt: '2026-09-18T11:21:02.000Z',
      error: null,
      result: {
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
    });
    const overwritten = await repository.finishIfProcessing({
      id,
      sessionId: null,
      status: StudyStatus.Error,
      originalFileName: 'other.dcm',
      storedFilePath: path.join(directory, 'other.dcm'),
      createdAt,
      updatedAt: '2026-09-18T11:21:03.000Z',
      error: 'Не удалось проверить качество укладки.',
      result: null,
    });

    expect(completed).toBe(true);
    expect(overwritten).toBe(false);
    const row = readRow(id);
    expect(row?.status).toBe('completed');
    expect(row?.quality_class).toBe(0);
    expect(row?.error).toBeNull();
    expect(row?.original_file_name).toBe('spine.dcm');
  });
});
