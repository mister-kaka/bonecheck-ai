import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';

@Injectable()
export class FileStorageService {
  async save(studyId: string, originalFileName: string, buffer: Buffer): Promise<string> {
    const directory = path.join(this.rootDir(), studyId);
    await fs.mkdir(directory, { recursive: true });

    const safeName = this.safeFileName(originalFileName);
    const filePath = path.join(directory, safeName);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async read(storedFilePath: string): Promise<Buffer | null> {
    const located = await this.locate(storedFilePath);
    if (!located) {
      return null;
    }

    try {
      return await fs.readFile(located);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async locate(storedFilePath: string): Promise<string | null> {
    const root = await this.realDir(this.rootDir());
    const resolved = await this.realDir(storedFilePath);
    if (!root || !resolved) {
      return null;
    }

    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    return resolved;
  }

  private async realDir(target: string): Promise<string | null> {
    try {
      return await fs.realpath(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private rootDir(): string {
    return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
  }

  private safeFileName(originalFileName: string): string {
    const base = path.basename(originalFileName).replace(/[<>:"/\\|?*\u0000]/g, '_');
    if (base.length === 0 || base === '.' || base === '..') {
      return 'study.dcm';
    }

    return base;
  }
}
