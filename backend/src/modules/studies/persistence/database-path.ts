import path from 'path';

export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.resolve(process.cwd(), 'data', 'bonecheck.sqlite');
}
