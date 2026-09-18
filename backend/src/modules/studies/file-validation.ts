export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.dcm', '.dicom']);
const ALLOWED_MIME_TYPES = new Set([
  'application/dicom',
  'application/x-dicom',
  'application/dicom+json',
  'application/octet-stream',
]);

export function isAllowedDicomUpload(originalName: string, mimeType: string): boolean {
  const lowerName = originalName.toLowerCase();
  const extension = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
  const mime = (mimeType ?? '').toLowerCase();

  if (ALLOWED_EXTENSIONS.has(extension)) {
    return true;
  }

  if (ALLOWED_MIME_TYPES.has(mime) && extension === '') {
    return true;
  }

  return mime === 'application/dicom' || mime === 'application/x-dicom';
}
