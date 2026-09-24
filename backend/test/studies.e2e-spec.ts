/// <reference types="jest" />
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Исследования (сквозные тесты)', () => {
  let app: INestApplication;
  let uploadDir: string;
  let previousDatabasePath: string | undefined;

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(os.tmpdir(), 'ruen-studies-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.UPLOAD_DIR = uploadDir;
    process.env.DATABASE_PATH = path.join(uploadDir, 'bonecheck.sqlite');
    process.env.ML_MOCK_DELAY_MS = '0';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previousDatabasePath;
    }
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const waitForCompleted = async (id: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request(app.getHttpServer()).get(`/api/studies/${id}`).expect(200);
      if (response.body.status === 'completed' || response.body.status === 'error') {
        return response.body;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error('исследование не завершилось');
  };

  it('POST /api/studies без файла -> 400', async () => {
    const response = await request(app.getHttpServer()).post('/api/studies').expect(400);
    expect(response.body.code).toBe('FILE_REQUIRED');
  });

  it('POST /api/studies с png -> 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/studies')
      .attach('file', Buffer.from('not-dicom'), 'photo.png')
      .expect(400);
    expect(response.body.code).toBe('INVALID_FILE_TYPE');
  });

  it('неизвестное исследование -> 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/studies/3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21')
      .expect(404);
    expect(response.body.code).toBe('STUDY_NOT_FOUND');
  });

  it('создание -> статус -> результат', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/studies')
      .attach('file', Buffer.from('dicom-bytes'), 'spine.dcm')
      .expect(201);

    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.status).toBe('processing');
    expect(created.body.sessionId).toBeNull();

    await waitForCompleted(created.body.id);

    const result = await request(app.getHttpServer())
      .get(`/api/studies/${created.body.id}/result`)
      .expect(200);

    expect(result.body.studyId).toBe(created.body.id);
    expect([0, 1]).toContain(result.body.quality_class);
    expect(typeof result.body.violation_type).toBe('string');
  });

  it('фильтрует историю по session_id и отдаёт все исследования без фильтра', async () => {
    const studyA = await request(app.getHttpServer())
      .post('/api/studies')
      .field('session_id', 'A')
      .attach('file', Buffer.from('dicom-bytes'), 'spine-a.dcm')
      .expect(201);
    const studyB = await request(app.getHttpServer())
      .post('/api/studies')
      .field('session_id', 'B')
      .attach('file', Buffer.from('dicom-bytes'), 'spine-b.dcm')
      .expect(201);

    expect(studyA.body.sessionId).toBe('A');
    expect(studyB.body.sessionId).toBe('B');

    const onlyB = await request(app.getHttpServer())
      .get('/api/studies')
      .query({ session_id: 'B' })
      .expect(200);
    const onlyBIds = onlyB.body.items.map((item: { id: string }) => item.id);
    expect(onlyBIds).toContain(studyB.body.id);
    expect(onlyBIds).not.toContain(studyA.body.id);

    const all = await request(app.getHttpServer()).get('/api/studies').expect(200);
    const allIds = all.body.items.map((item: { id: string }) => item.id);
    expect(allIds).toEqual(expect.arrayContaining([studyA.body.id, studyB.body.id]));
  });

  it('отклоняет слишком длинный session_id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/studies')
      .field('session_id', 'x'.repeat(129))
      .attach('file', Buffer.from('dicom-bytes'), 'spine.dcm')
      .expect(400);
    expect(response.body.code).toBe('INVALID_SESSION_ID');
  });

  it('сохраняет исследование после перезапуска приложения', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/studies')
      .field('session_id', 'A')
      .attach('file', Buffer.from('dicom-bytes'), 'restart.dcm')
      .expect(201);

    await waitForCompleted(created.body.id);
    const before = await request(app.getHttpServer())
      .get(`/api/studies/${created.body.id}/result`)
      .expect(200);

    await app.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const after = await request(app.getHttpServer())
      .get(`/api/studies/${created.body.id}/result`)
      .expect(200);
    expect(after.body).toEqual(before.body);

    const status = await request(app.getHttpServer())
      .get(`/api/studies/${created.body.id}`)
      .expect(200);
    expect(status.body.status).toBe('completed');
    expect(status.body.sessionId).toBe('A');
    expect(status.body.hasResult).toBe(true);
  });
});
