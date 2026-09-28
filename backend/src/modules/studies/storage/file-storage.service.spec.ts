/// <reference types="jest" />
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  let directory: string;
  let previousUploadDir: string | undefined;

  beforeEach(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), 'ruen-uploads-'));
    previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = directory;
  });

  afterEach(() => {
    if (previousUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = previousUploadDir;
    }

    rmSync(directory, { recursive: true, force: true });
  });

  it('stores a dicom file inside the study directory', async () => {
    const service = new FileStorageService();
    const stored = await service.save('study-1', 'spine.dcm', Buffer.from('dicom'));

    expect(stored).toBe(path.join(directory, 'study-1', 'spine.dcm'));
    expect(readFileSync(stored).toString()).toBe('dicom');
  });

  it('replaces unsafe characters and keeps the file inside the study directory', async () => {
    const service = new FileStorageService();
    const stored = await service.save('study-1', 'a<b>:c.dcm', Buffer.from('x'));

    expect(path.basename(stored)).toBe('a_b__c.dcm');
    expect(path.dirname(stored)).toBe(path.join(directory, 'study-1'));
  });

  it('does not let the file name escape the study directory', async () => {
    const service = new FileStorageService();
    const nested = await service.save('study-nested', '../../secret.dcm', Buffer.from('a'));
    const parent = await service.save('study-parent', '..', Buffer.from('b'));
    const empty = await service.save('study-empty', '', Buffer.from('c'));

    expect(path.dirname(nested)).toBe(path.join(directory, 'study-nested'));
    expect(path.basename(nested)).toBe('secret.dcm');
    expect(parent).toBe(path.join(directory, 'study-parent', 'study.dcm'));
    expect(empty).toBe(path.join(directory, 'study-empty', 'study.dcm'));
    expect(readFileSync(parent).toString()).toBe('b');
    expect(readFileSync(empty).toString()).toBe('c');
  });

  it('читает файл исследования и не отдаёт путь вне каталога загрузок', async () => {
    const service = new FileStorageService();
    const stored = await service.save('study-1', 'spine.dcm', Buffer.from('dicom'));

    await expect(service.read(stored)).resolves.toEqual(Buffer.from('dicom'));
    await expect(service.read(path.join(directory, 'missing', 'spine.dcm'))).resolves.toBeNull();
    await expect(service.read(path.join(directory, '..', 'secret.dcm'))).resolves.toBeNull();
  });
});
