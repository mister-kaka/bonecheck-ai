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

  private rootDir(): string {
    return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
  }

  private safeFileName(originalFileName: string): string {
    const base = path.basename(originalFileName).replace(/[<>:"/\\|?*\u0000]/g, '_');
    return base.length > 0 ? base : 'study.dcm';
  }
}
