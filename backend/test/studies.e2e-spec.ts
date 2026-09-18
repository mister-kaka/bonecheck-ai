import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Studies (e2e)', () => {
  let app: INestApplication;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(os.tmpdir(), 'ruen-studies-'));
    process.env.UPLOAD_DIR = uploadDir;
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

    throw new Error('study did not finish');
  };

  it('POST /api/studies without file -> 400', async () => {
    const response = await request(app.getHttpServer()).post('/api/studies').expect(400);
    expect(response.body.code).toBe('FILE_REQUIRED');
  });

  it('POST /api/studies with png -> 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/studies')
      .attach('file', Buffer.from('not-dicom'), 'photo.png')
      .expect(400);
    expect(response.body.code).toBe('INVALID_FILE_TYPE');
  });

  it('unknown study -> 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/studies/3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21')
      .expect(404);
    expect(response.body.code).toBe('STUDY_NOT_FOUND');
  });

  it('create -> status -> result', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/studies')
      .attach('file', Buffer.from('dicom-bytes'), 'spine.dcm')
      .expect(201);

    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.status).toBe('processing');

    await waitForCompleted(created.body.id);

    const result = await request(app.getHttpServer())
      .get(`/api/studies/${created.body.id}/result`)
      .expect(200);

    expect(result.body.studyId).toBe(created.body.id);
    expect([0, 1]).toContain(result.body.quality_class);
    expect(typeof result.body.violation_type).toBe('string');
  });
});
