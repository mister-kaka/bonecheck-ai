/// <reference types="jest" />
import path from 'path';
import { resolveDatabasePath, resolveUploadDir } from './database-path';

describe('data locations', () => {
  const previousDatabasePath = process.env.DATABASE_PATH;
  const previousUploadDir = process.env.UPLOAD_DIR;
  const previousRender = process.env.RENDER;

  afterEach(() => {
    restore('DATABASE_PATH', previousDatabasePath);
    restore('UPLOAD_DIR', previousUploadDir);
    restore('RENDER', previousRender);
  });

  it('keeps an explicit database path', () => {
    process.env.DATABASE_PATH = 'custom/bonecheck.sqlite';
    delete process.env.RENDER;
    expect(resolveDatabasePath()).toBe(path.resolve('custom/bonecheck.sqlite'));
  });

  it('uses the local data directory when nothing is configured', () => {
    delete process.env.DATABASE_PATH;
    delete process.env.RENDER;
    expect(resolveDatabasePath()).toBe(path.resolve(process.cwd(), 'data', 'bonecheck.sqlite'));
  });

  it('uses the Render disk for the database and uploads', () => {
    delete process.env.DATABASE_PATH;
    delete process.env.UPLOAD_DIR;
    process.env.RENDER = 'true';
    expect(resolveDatabasePath()).toBe('/var/data/bonecheck.sqlite');
    expect(resolveUploadDir()).toBe('/var/data/uploads');
  });

  it('keeps an explicit upload directory on Render', () => {
    process.env.RENDER = 'true';
    process.env.UPLOAD_DIR = '/tmp/uploads';
    expect(resolveUploadDir()).toBe('/tmp/uploads');
  });
});

function restore(name: 'DATABASE_PATH' | 'UPLOAD_DIR' | 'RENDER', previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}
