import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveUploadDir } from '../persistence/database-path';

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

  async write(storedFilePath: string, buffer: Buffer): Promise<void> {
    const destination = await this.destination(storedFilePath);
    const existing = await this.realDir(destination);
    if (existing && !this.isInside(await this.requireRoot(), existing)) {
      throw new Error('Путь вне каталога загрузок');
    }
    await fs.writeFile(destination, buffer);
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
    if (!root || !resolved || !this.isInside(root, resolved)) {
      return null;
    }

    return resolved;
  }

  private async destination(storedFilePath: string): Promise<string> {
    const root = await this.requireRoot();
    const parentReal = await this.realDir(path.dirname(storedFilePath));
    if (!parentReal) {
      throw new Error('Каталог для записи недоступен');
    }
    if (!this.isInside(root, parentReal)) {
      throw new Error('Путь вне каталога загрузок');
    }

    const base = path.basename(storedFilePath);
    if (base.length === 0 || base === '.' || base === '..') {
      throw new Error('Некорректное имя файла');
    }

    return path.join(parentReal, base);
  }

  private async requireRoot(): Promise<string> {
    const root = await this.realDir(this.rootDir());
    if (!root) {
      throw new Error('Каталог загрузок недоступен');
    }
    return root;
  }

  private isInside(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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
    return resolveUploadDir();
  }

  private safeFileName(originalFileName: string): string {
    const base = path.basename(originalFileName).replace(/[<>:"/\\|?*\u0000]/g, '_');
    if (base.length === 0 || base === '.' || base === '..') {
      return 'study.dcm';
    }

    return base;
  }
}
