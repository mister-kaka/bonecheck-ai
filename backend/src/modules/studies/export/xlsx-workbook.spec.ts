/// <reference types="jest" />
import { unzipSync, strFromU8 } from 'fflate';
import { buildXlsx, XLSX_HEADERS, xlsxDownloadName } from './xlsx-workbook';

function sheetXml(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const sheet = files['xl/worksheets/sheet1.xml'];
  expect(sheet).toBeDefined();
  return strFromU8(sheet);
}

describe('buildXlsx', () => {
  it('собирает книгу с заголовками и строками исследований', () => {
    const buffer = buildXlsx([
      [...XLSX_HEADERS],
      [
        'spine.dcm',
        '18.09.2026 11:21 UTC',
        'Поясничный отдел позвоночника',
        'Корректно',
        '',
        '5%',
        'Готово',
      ],
      [
        'hip.dcm',
        '18.09.2026 11:22 UTC',
        'Проксимальный отдел бедра',
        'Нарушение',
        'Некорректная укладка',
        '',
        'Готово',
      ],
    ]);

    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const xml = sheetXml(buffer);
    expect(xml).toContain('spine.dcm');
    expect(xml).toContain('hip.dcm');
    expect(xml).toContain('Поясничный отдел позвоночника');
    expect(xml).toContain('Некорректная укладка');
    expect(xml).toContain('5%');
    expect(xml).toContain('<row r="1">');
    expect(xml).toContain('<row r="3">');
  });

  it('для пустой выборки оставляет только заголовки', () => {
    const xml = sheetXml(buildXlsx([[...XLSX_HEADERS]]));
    expect(xml).toContain('Вероятность нарушения');
    expect(xml).toContain('<row r="1">');
    expect(xml).not.toContain('<row r="2">');
  });

  it('называет файл по одному исследованию и иначе как историю', () => {
    expect(xlsxDownloadName(['spine.dcm'])).toBe('bonecheck-spine.xlsx');
    expect(xlsxDownloadName(['поясница.dcm'])).toBe('bonecheck-study.xlsx');
    expect(xlsxDownloadName(['a.dcm', 'b.dcm'])).toBe('bonecheck-history.xlsx');
    expect(xlsxDownloadName([])).toBe('bonecheck-history.xlsx');
  });
});
