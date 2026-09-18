// import { isAllowedDicomUpload } from './file-validation';

// describe('isAllowedDicomUpload', () => {
//   it('accepts .dcm and .dicom files', () => {
//     expect(isAllowedDicomUpload('study.dcm', 'application/octet-stream')).toBe(true);
//     expect(isAllowedDicomUpload('study.dicom', 'application/octet-stream')).toBe(true);
//   });

//   it('accepts application/dicom without an extension', () => {
//     expect(isAllowedDicomUpload('study', 'application/dicom')).toBe(true);
//   });

//   it('rejects images', () => {
//     expect(isAllowedDicomUpload('x.png', 'image/png')).toBe(false);
//   });
// });
