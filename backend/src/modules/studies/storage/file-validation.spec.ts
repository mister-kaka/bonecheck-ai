/// <reference types="jest" />
import { isAllowedDicomUpload } from './file-validation';

describe('isAllowedDicomUpload', () => {
  it('принимает файлы .dcm и .dicom', () => {
    expect(isAllowedDicomUpload('study.dcm', 'application/octet-stream')).toBe(true);
    expect(isAllowedDicomUpload('study.dicom', 'application/octet-stream')).toBe(true);
  });

  it('принимает application/dicom без расширения', () => {
    expect(isAllowedDicomUpload('study', 'application/dicom')).toBe(true);
  });

  it('принимает DICOM MIME при другом расширении и без расширения', () => {
    expect(isAllowedDicomUpload('notes.txt', 'application/dicom')).toBe(true);
    expect(isAllowedDicomUpload('study', 'application/x-dicom')).toBe(true);
  });

  it('отклоняет изображения и прочие MIME без расширения DICOM', () => {
    expect(isAllowedDicomUpload('x.png', 'image/png')).toBe(false);
    expect(isAllowedDicomUpload('study', 'application/octet-stream')).toBe(false);
    expect(isAllowedDicomUpload('study', 'application/dicom+json')).toBe(false);
    expect(isAllowedDicomUpload('photo.png', 'application/octet-stream')).toBe(false);
  });
});
