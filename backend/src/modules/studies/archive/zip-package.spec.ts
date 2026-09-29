/// <reference types="jest" />
import { strToU8, zipSync } from 'fflate';
import { crc32 } from 'zlib';
import { MAX_FILE_SIZE_BYTES } from '../storage/file-validation';
import { MAX_ZIP_ENTRIES, readZipPackage, ZipPackageError } from './zip-package';

function zipOf(files: Record<string, string | Uint8Array>): Buffer {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(files)) {
    entries[name] = typeof value === 'string' ? strToU8(value) : value;
  }
  return Buffer.from(zipSync(entries));
}

function expectCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(ZipPackageError);
  expect((error as ZipPackageError).code).toBe(code);
}

describe('readZipPackage', () => {
  it('читает один и несколько DICOM, в том числе из вложенной папки', async () => {
    const one = await readZipPackage(zipOf({ 'spine.dcm': 'dicom-a' }));
    expect(one).toEqual([
      { originalName: 'spine.dcm', buffer: Buffer.from('dicom-a') },
    ]);

    const nested = await readZipPackage(
      zipOf({
        'study/images/spine.dcm': 'dicom-a',
        'study/hip.dicom': 'dicom-b',
      }),
    );
    expect(nested.map((file) => file.originalName)).toEqual([
      'spine.dcm',
      'hip.dicom',
    ]);
    expect(nested[0].buffer.toString()).toBe('dicom-a');
  });

  it('отклоняет пустой, повреждённый и слишком большой архив', async () => {
    await expectCodeAsync(Buffer.alloc(0), 'ZIP_EMPTY');
    await expectCodeAsync(zipOf({}), 'ZIP_EMPTY');
    await expectCodeAsync(Buffer.from('this is not a zip'), 'INVALID_ZIP');
    await expectCodeAsync(Buffer.alloc(MAX_FILE_SIZE_BYTES + 1), 'FILE_TOO_LARGE');
  });

  it('отклоняет архив без DICOM и архив с посторонним файлом', async () => {
    await expectCodeAsync(zipOf({ 'notes.txt': 'hello' }), 'ZIP_NO_DICOM');
    await expectCodeAsync(
      zipOf({ 'spine.dcm': 'dicom', 'notes.txt': 'hello' }),
      'ZIP_UNSUPPORTED_FILE',
    );
  });

  it('отклоняет path traversal, абсолютные пути и дубликаты', async () => {
    const unsafe = [
      '../spine.dcm',
      'nested/../../spine.dcm',
      '/tmp/spine.dcm',
      'C:/spine.dcm',
      '..\\spine.dcm',
    ];

    for (const name of unsafe) {
      await expectCodeAsync(zipOf({ [name]: 'dicom' }), 'ZIP_PATH_TRAVERSAL');
    }

    await expectCodeAsync(
      zipOf({
        'a/spine.dcm': 'one',
        'b/spine.dcm': 'two',
      }),
      'ZIP_DUPLICATE',
    );
  });

  it('отклоняет слишком большой файл внутри и слишком много записей', async () => {
    const small = zipOf({ 'spine.dcm': 'dicom' });
    const central = small.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(central).toBeGreaterThanOrEqual(0);
    const patched = Buffer.from(small);
    patched.writeUInt32LE(MAX_FILE_SIZE_BYTES + 1, central + 24);

    await expectCodeAsync(patched, 'FILE_TOO_LARGE');

    const many: Record<string, string> = {};
    for (let index = 0; index < MAX_ZIP_ENTRIES + 1; index += 1) {
      many[`file-${index}.dcm`] = 'x';
    }

    await expectCodeAsync(zipOf(many), 'ZIP_TOO_MANY_FILES');
  });

  it('декодирует имя по флагу ZIP: UTF-8, CP866 и ASCII', async () => {
    const utf8 = await readZipPackage(zipOf({ 'ПОП.dcm': 'dicom-utf8' }));
    expect(utf8.map((file) => file.originalName)).toEqual(['ПОП.dcm']);
    expect(utf8[0].buffer.toString()).toBe('dicom-utf8');

    const cp866Name = Buffer.concat([
      Buffer.from('CR000000_'),
      Buffer.from([0x8f, 0x8e, 0x8f]),
      Buffer.from('.dcm'),
    ]);
    const legacy = await readZipPackage(storedZip(cp866Name, Buffer.from('dicom-cp866'), false));
    expect(legacy).toEqual([
      { originalName: 'CR000000_ПОП.dcm', buffer: Buffer.from('dicom-cp866') },
    ]);

    const nestedCp866 = Buffer.concat([Buffer.from('study/'), cp866Name]);
    const nested = await readZipPackage(
      storedZip(nestedCp866, Buffer.from('dicom-nested'), false),
    );
    expect(nested.map((file) => file.originalName)).toEqual(['CR000000_ПОП.dcm']);

    const ascii = await readZipPackage(storedZip(Buffer.from('spine.dcm'), Buffer.from('dicom-ascii'), false));
    expect(ascii.map((file) => file.originalName)).toEqual(['spine.dcm']);
  });
});

async function expectCodeAsync(buffer: Buffer, code: string): Promise<void> {
  try {
    await readZipPackage(buffer);
  } catch (error) {
    expectCode(error, code);
    return;
  }
  throw new Error(`архив принят, ожидался код ${code}`);
}

function storedZip(name: Buffer, data: Buffer, utf8: boolean): Buffer {
  const crc = crc32(data) >>> 0;
  const flag = utf8 ? 0x800 : 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(flag, 6);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(flag, 8);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + name.length, 12);
  eocd.writeUInt32LE(30 + name.length + data.length, 16);

  return Buffer.concat([local, name, data, central, name, eocd]);
}
