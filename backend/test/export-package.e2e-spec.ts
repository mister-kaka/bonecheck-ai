/// <reference types="jest" />
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { MAX_FILE_SIZE_BYTES } from '../src/modules/studies/storage/file-validation';
import { formatMoscowDateTime } from '../src/modules/studies/export/moscow-time';

function readBinary(res: any, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function zipOf(files: Record<string, string>): Buffer {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(files)) {
    entries[name] = strToU8(value);
  }
  return Buffer.from(zipSync(entries));
}

describe('XLSX и ZIP (сквозные тесты)', () => {
  let app: INestApplication;
  let uploadDir: string;
  let previousDatabasePath: string | undefined;

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(os.tmpdir(), 'bonecheck-package-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.UPLOAD_DIR = uploadDir;
    process.env.DATABASE_PATH = path.join(uploadDir, 'bonecheck.sqlite');
    process.env.ML_CLIENT = 'mock';
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

  it('GET /api/studies/export: один, несколько, пустая выборка, неизвестный id', async () => {
    const empty = await request(app.getHttpServer())
      .get('/api/studies/export')
      .query({ session_id: 'empty-session' })
      .buffer(true)
      .parse(readBinary)
      .expect(200);

    expect(empty.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(empty.headers['content-disposition']).toContain('bonecheck-history.xlsx');
    const emptySheet = unzipSync(empty.body);
    const emptyXml = Buffer.from(emptySheet['xl/worksheets/sheet1.xml']).toString('utf8');
    expect(emptyXml).toContain('Анатомическая область');
    expect(emptyXml).not.toContain('<row r="2">');

    const spine = await request(app.getHttpServer())
      .post('/api/studies')
      .attach('file', Buffer.from('dicom-bytes'), 'spine.dcm')
      .expect(201);
    const hip = await request(app.getHttpServer())
      .post('/api/studies')
      .attach('file', Buffer.from('dicom-bytes'), 'hip.dcm')
      .expect(201);

    await waitForCompleted(spine.body.id);
    await waitForCompleted(hip.body.id);

    const one = await request(app.getHttpServer())
      .get('/api/studies/export')
      .query({ ids: spine.body.id })
      .buffer(true)
      .parse(readBinary)
      .expect(200);

    expect(one.headers['content-disposition']).toContain('bonecheck-spine.xlsx');
    const oneXml = Buffer.from(
      unzipSync(one.body)['xl/worksheets/sheet1.xml'],
    ).toString('utf8');
    expect(oneXml).toContain('spine.dcm');
    expect(oneXml).toContain('Корректно');
    expect(oneXml).toContain('Вероятность нарушения');
    expect(oneXml).not.toContain('5%');
    expect(oneXml).toContain(formatMoscowDateTime(spine.body.createdAt));
    expect(oneXml).not.toContain(' UTC');
    expect(oneXml).not.toContain('hip.dcm');

    const file = await request(app.getHttpServer())
      .get(`/api/studies/${spine.body.id}/file`)
      .buffer(true)
      .parse(readBinary)
      .expect(200);
    expect(file.headers['content-type']).toContain('application/dicom');
    expect(file.body.equals(Buffer.from('dicom-bytes'))).toBe(true);

    const missingFile = await request(app.getHttpServer())
      .get('/api/studies/3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21/file')
      .expect(404);
    expect(missingFile.body.code).toBe('STUDY_NOT_FOUND');

    const many = await request(app.getHttpServer())
      .get('/api/studies/export')
      .query({ ids: `${hip.body.id},${spine.body.id}` })
      .buffer(true)
      .parse(readBinary)
      .expect(200);
    const manyXml = Buffer.from(
      unzipSync(many.body)['xl/worksheets/sheet1.xml'],
    ).toString('utf8');
    expect(manyXml).toContain('spine.dcm');
    expect(manyXml).toContain('hip.dcm');

    const missing = await request(app.getHttpServer())
      .get('/api/studies/export')
      .query({ ids: '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21' })
      .expect(404);
    expect(missing.body.code).toBe('STUDY_NOT_FOUND');

    const badId = await request(app.getHttpServer())
      .get('/api/studies/export')
      .query({ ids: 'not-a-uuid' })
      .expect(400);
    expect(badId.body.code).toBe('BAD_REQUEST');
  });

  it('POST /api/studies/packages принимает DICOM и отклоняет плохие архивы', async () => {
    const before = readdirSync(uploadDir);

    const created = await request(app.getHttpServer())
      .post('/api/studies/packages')
      .field('session_id', 'zip-session')
      .attach(
        'file',
        zipOf({
          'pack/spine.dcm': 'dicom-a',
          'hip.dicom': 'dicom-b',
        }),
        'study.zip',
      )
      .expect(201);

    expect(created.body.items).toHaveLength(2);
    expect(created.body.items.map((item: { originalFileName: string }) => item.originalFileName)).toEqual([
      'spine.dcm',
      'hip.dicom',
    ]);
    expect(created.body.items[0].status).toBe('processing');
    expect(created.body.items[0].sessionId).toBe('zip-session');

    await waitForCompleted(created.body.items[0].id);
    const result = await request(app.getHttpServer())
      .get(`/api/studies/${created.body.items[0].id}/result`)
      .expect(200);
    expect(result.body.quality_class).toBe(0);

    const cases: Array<{ name: string; zip: Buffer; code: string; status: number }> = [
      { name: 'empty.zip', zip: zipOf({}), code: 'ZIP_EMPTY', status: 400 },
      { name: 'broken.zip', zip: Buffer.from('not-a-zip'), code: 'INVALID_ZIP', status: 400 },
      { name: 'notes.zip', zip: zipOf({ 'notes.txt': 'hello' }), code: 'ZIP_NO_DICOM', status: 400 },
      {
        name: 'mixed.zip',
        zip: zipOf({ 'spine.dcm': 'dicom', 'notes.txt': 'hello' }),
        code: 'ZIP_UNSUPPORTED_FILE',
        status: 400,
      },
      {
        name: 'slip.zip',
        zip: zipOf({ '../spine.dcm': 'dicom' }),
        code: 'ZIP_PATH_TRAVERSAL',
        status: 400,
      },
      {
        name: 'nested-slip.zip',
        zip: zipOf({ 'a/../../spine.dcm': 'dicom' }),
        code: 'ZIP_PATH_TRAVERSAL',
        status: 400,
      },
      {
        name: 'dup.zip',
        zip: zipOf({ 'a/spine.dcm': 'one', 'b/spine.dcm': 'two' }),
        code: 'ZIP_DUPLICATE',
        status: 400,
      },
    ];

    for (const item of cases) {
      const response = await request(app.getHttpServer())
        .post('/api/studies/packages')
        .attach('file', item.zip, item.name)
        .expect(item.status);
      expect(response.body.code).toBe(item.code);
      expect(response.body.message).toEqual(expect.any(String));
    }

    const png = await request(app.getHttpServer())
      .post('/api/studies/packages')
      .attach('file', Buffer.from('png'), 'photo.png')
      .expect(400);
    expect(png.body.code).toBe('INVALID_FILE_TYPE');

    const huge = await request(app.getHttpServer())
      .post('/api/studies/packages')
      .attach('file', Buffer.alloc(MAX_FILE_SIZE_BYTES + 1), 'huge.zip')
      .expect(413);
    expect(huge.body.code).toBe('FILE_TOO_LARGE');

    const after = readdirSync(uploadDir);
    expect(after.some((name) => name.includes('..'))).toBe(false);
    expect(after.filter((name) => !before.includes(name) && name !== 'bonecheck.sqlite').length).toBeGreaterThan(0);
  });

  it('swagger описывает выгрузку и пакет', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('BoneCheck AI').setVersion('0.4.0').build(),
    );
    expect(document.paths['/api/studies/export']).toBeDefined();
    expect(document.paths['/api/studies/packages']).toBeDefined();
    expect(document.paths['/api/studies/export']?.get?.responses?.['200']).toBeDefined();
    expect(document.paths['/api/studies/packages']?.post?.responses?.['201']).toBeDefined();
    expect(document.paths['/api/studies/export']?.get?.responses?.['404']).toBeDefined();
  });
});
