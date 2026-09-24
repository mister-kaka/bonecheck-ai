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

  it('отклоняет изображения', () => {
    expect(isAllowedDicomUpload('x.png', 'image/png')).toBe(false);
  });
});
