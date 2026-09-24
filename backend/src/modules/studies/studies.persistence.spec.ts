/// <reference types="jest" />
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { MockMlClient } from '../ml/mock-ml.client';
import { MlClient } from '../ml/ml.types';
import { SqliteStudyRepository } from './sqlite-study.repository';
import { StudiesService } from './studies.service';
import { StudyStatus } from './study.types';

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
    directory = mkdtempSync(path.join(os.tmpdir(), 'ruen-sqlite-'));
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

    const db = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      return db.prepare('SELECT * FROM studies WHERE id = ?').get(id) as StudySqlRow | undefined;
    } finally {
      db.close();
    }
  }

  function readIds(): string[] {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
      throw new Error('DATABASE_PATH is not set');
    }

    const db = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      const rows = db.prepare('SELECT id FROM studies').all() as Array<{ id: string }>;
      return rows.map((row) => row.id);
    } finally {
      db.close();
    }
  }

  async function waitForStatus(service: StudiesService, id: string, status: StudyStatus) {
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
    const db = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'studies'")
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
      quality_prob: 0.05,
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
      quality_prob: 0.05,
      anatomical_region: 'Поясничный отдел позвоночника',
    });
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
    expect(row?.error).toBe('Ошибка обработки ML.');
    expect(row?.quality_class).toBeNull();
    expect(row?.violation_type).toBeNull();

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
    expect(all.items.map((item) => item.id)).toEqual(expect.arrayContaining([studyA.id, studyB.id]));
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
    expect((await first.service.getById(created.id)).status).toBe(StudyStatus.Processing);
    first.repository.onModuleDestroy();

    const second = openService();
    await second.service.onModuleInit();
    const status = await waitForStatus(second.service, created.id, StudyStatus.Completed);
    expect(status.sessionId).toBe('A');
    expect(status.hasResult).toBe(true);

    release();
    const result = await second.service.getResult(created.id);
    expect(result.quality_class).toBe(0);
    expect(result.violation_type).toBe('');
  });
});
