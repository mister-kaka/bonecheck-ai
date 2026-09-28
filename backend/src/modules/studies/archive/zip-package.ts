import { unzipSync, type UnzipFileInfo } from 'fflate';
import { MAX_FILE_SIZE_BYTES } from '../storage/file-validation';

export const MAX_ZIP_ENTRIES = 30;

// Сжатый архив ограничен 50 МБ, но распакованный объём ограничиваем отдельно:
// иначе маленький ZIP может развернуться в гигабайты.
export const MAX_ZIP_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

export type ZipDicomFile = {
  originalName: string;
  buffer: Buffer;
};

export class ZipPackageError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

const DICOM_EXTENSIONS = new Set(['.dcm', '.dicom']);

/**
 * Читает DICOM из ZIP только в память.
 * Имена записей архива не соединяются с каталогом исследования:
 * на диск уходит уже отдельный buffer и одно имя файла без пути.
 */
export function readZipPackage(buffer: Buffer): ZipDicomFile[] {
  if (buffer.length === 0) {
    throw new ZipPackageError('ZIP_EMPTY', 'Архив пустой.', 400);
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ZipPackageError(
      'FILE_TOO_LARGE',
      'Файл слишком большой. Максимальный размер - 50 МБ.',
      413,
    );
  }

  const listed = listZipEntries(buffer);
  if (listed.length === 0) {
    throw new ZipPackageError('ZIP_EMPTY', 'Архив пустой.', 400);
  }

  if (listed.length > MAX_ZIP_ENTRIES) {
    throw new ZipPackageError(
      'ZIP_TOO_MANY_FILES',
      `В архиве слишком много файлов. Максимум - ${MAX_ZIP_ENTRIES}.`,
      400,
    );
  }

  const payload = listed.filter((entry) => !isSkippableEntry(entry.name));
  if (payload.length === 0) {
    throw new ZipPackageError('ZIP_EMPTY', 'Архив пустой.', 400);
  }

  for (const entry of payload) {
    if (isUnsafeZipPath(entry.name)) {
      throw new ZipPackageError(
        'ZIP_PATH_TRAVERSAL',
        'Архив содержит небезопасный путь и не будет распакован.',
        400,
      );
    }
  }

  const dicoms: ListedZipEntry[] = [];
  const others: string[] = [];

  for (const entry of payload) {
    const base = baseName(entry.name);
    if (isDicomBaseName(base)) {
      dicoms.push(entry);
    } else {
      others.push(base);
    }
  }

  if (dicoms.length === 0) {
    throw new ZipPackageError('ZIP_NO_DICOM', 'В архиве нет DICOM-файлов.', 400);
  }

  if (others.length > 0) {
    throw new ZipPackageError(
      'ZIP_UNSUPPORTED_FILE',
      `Файл «${others[0]}» не является DICOM. В архиве допускаются только .dcm и .dicom.`,
      400,
    );
  }

  const wanted = new Map<string, { archiveName: string; base: string }>();
  let uncompressed = 0;

  for (const entry of dicoms) {
    const base = baseName(entry.name);
    const key = base.toLowerCase();
    if (wanted.has(key)) {
      throw new ZipPackageError(
        'ZIP_DUPLICATE',
        `В архиве повторяется файл «${base}».`,
        400,
      );
    }

    if (entry.compression !== 0 && entry.compression !== 8) {
      throw new ZipPackageError(
        'INVALID_ZIP',
        'Архив повреждён или использует неподдерживаемое сжатие.',
        400,
      );
    }

    if (!Number.isFinite(entry.originalSize) || entry.originalSize < 0) {
      throw new ZipPackageError(
        'INVALID_ZIP',
        'Архив повреждён или не является ZIP.',
        400,
      );
    }

    if (entry.originalSize === 0) {
      throw new ZipPackageError('FILE_REQUIRED', 'Файл исследования пустой.', 400);
    }

    if (entry.originalSize > MAX_FILE_SIZE_BYTES) {
      throw new ZipPackageError(
        'FILE_TOO_LARGE',
        'Файл в архиве слишком большой. Максимальный размер - 50 МБ.',
        413,
      );
    }

    uncompressed += entry.originalSize;
    if (uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new ZipPackageError(
        'FILE_TOO_LARGE',
        'Распакованный архив слишком большой.',
        413,
      );
    }

    wanted.set(key, { archiveName: entry.archiveName, base });
  }

  const files: ZipDicomFile[] = [];
  let actualUncompressed = 0;
  for (const [key, entry] of wanted) {
    const bytes = inflateZipEntry(buffer, entry.archiveName);
    if (!bytes || bytes.length === 0) {
      throw new ZipPackageError('FILE_REQUIRED', 'Файл исследования пустой.', 400);
    }
    if (bytes.length > MAX_FILE_SIZE_BYTES) {
      throw new ZipPackageError(
        'FILE_TOO_LARGE',
        'Файл в архиве слишком большой. Максимальный размер - 50 МБ.',
        413,
      );
    }

    actualUncompressed += bytes.length;
    if (actualUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new ZipPackageError(
        'FILE_TOO_LARGE',
        'Распакованный архив слишком большой.',
        413,
      );
    }

    files.push({
      originalName: entry.base || key,
      buffer: Buffer.from(bytes),
    });
  }

  return files;
}

function inflateZipEntry(buffer: Buffer, archiveName: string): Uint8Array | undefined {
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(new Uint8Array(buffer), {
      filter: (file) => file.name === archiveName,
    });
  } catch {
    throw new ZipPackageError(
      'INVALID_ZIP',
      'Архив повреждён или не является ZIP.',
      400,
    );
  }

  return extracted[archiveName];
}

type ListedZipEntry = UnzipFileInfo & {
  archiveName: string;
};

function listZipEntries(buffer: Buffer): ListedZipEntry[] {
  const listed: UnzipFileInfo[] = [];
  try {
    unzipSync(new Uint8Array(buffer), {
      filter: (file) => {
        listed.push({
          name: file.name,
          size: file.size,
          originalSize: file.originalSize,
          compression: file.compression,
        });
        return false;
      },
    });
  } catch {
    throw new ZipPackageError(
      'INVALID_ZIP',
      'Архив повреждён или не является ZIP.',
      400,
    );
  }

  const decoded = readCentralDirectoryNames(buffer);
  return listed.map((entry, index) => {
    const meta = decoded?.[index];
    const name =
      meta && meta.archiveName === entry.name ? meta.decodedName : entry.name;
    return {
      ...entry,
      name,
      archiveName: entry.name,
    };
  });
}

const ZIP_UTF8_FLAG = 0x800;

type CentralName = {
  archiveName: string;
  decodedName: string;
};

// Бит 11 general-purpose flag: имя уже в UTF-8. Без флага fflate отдаёт байты как Latin-1,
// а русские ZIP без этого флага хранят имя в CP866.
function readCentralDirectoryNames(buffer: Buffer): CentralName[] | null {
  const eocd = findEocd(buffer);
  if (eocd < 0) {
    return null;
  }

  const count = buffer.readUInt16LE(eocd + 10);
  const offset = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) {
    return null;
  }

  const names: CentralName[] = [];
  let cursor = offset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      return null;
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) {
      return null;
    }

    const raw = buffer.subarray(nameStart, nameEnd);
    const utf8 = (flags & ZIP_UTF8_FLAG) !== 0;
    names.push({
      archiveName: utf8 ? decodeUtf8(raw) : decodeLatin1(raw),
      decodedName: utf8 ? decodeUtf8(raw) : decodeCp866(raw),
    });
    cursor = nameEnd + extraLength + commentLength;
  }

  return names;
}

function findEocd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function decodeUtf8(raw: Uint8Array): string {
  return new TextDecoder('utf-8').decode(raw);
}

function decodeLatin1(raw: Uint8Array): string {
  return Buffer.from(raw).toString('latin1');
}

function decodeCp866(raw: Uint8Array): string {
  return new TextDecoder('ibm866').decode(raw);
}

export function isUnsafeZipPath(name: string): boolean {
  if (!name || name.includes('\0')) {
    return true;
  }

  const slashed = name.replace(/\\/g, '/');
  if (slashed.startsWith('/') || slashed.startsWith('//')) {
    return true;
  }

  if (/^[A-Za-z]:/.test(slashed)) {
    return true;
  }

  return slashed.split('/').includes('..');
}

function isSkippableEntry(name: string): boolean {
  const slashed = name.replace(/\\/g, '/');
  if (slashed.endsWith('/')) {
    return true;
  }

  const parts = slashed.split('/');
  if (parts.includes('__MACOSX')) {
    return true;
  }

  const base = parts[parts.length - 1] ?? '';
  return base === '.DS_Store' || base === 'Thumbs.db';
}

function baseName(name: string): string {
  const slashed = name.replace(/\\/g, '/');
  const parts = slashed.split('/');
  return parts[parts.length - 1] ?? '';
}

function isDicomBaseName(base: string): boolean {
  const lower = base.toLowerCase();
  const extension = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  return DICOM_EXTENSIONS.has(extension);
}
