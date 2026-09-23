/// <reference types="jest" />
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Проверка работоспособности (сквозные тесты)', () => {
  let app: INestApplication;
  let uploadDir: string;
  let previousDatabasePath: string | undefined;

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(os.tmpdir(), 'ruen-health-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.UPLOAD_DIR = uploadDir;
    process.env.DATABASE_PATH = path.join(uploadDir, 'health.sqlite');
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

  it('GET /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
