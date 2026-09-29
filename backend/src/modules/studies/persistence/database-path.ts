import path from 'path';

const RENDER_DATA_ROOT = '/var/data';

export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  if (process.env.RENDER === 'true') {
    return `${RENDER_DATA_ROOT}/bonecheck.sqlite`;
  }

  return path.resolve(process.cwd(), 'data', 'bonecheck.sqlite');
}

export function resolveUploadDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.RENDER === 'true') {
    return `${RENDER_DATA_ROOT}/uploads`;
  }

  return path.join(process.cwd(), 'uploads');
}
