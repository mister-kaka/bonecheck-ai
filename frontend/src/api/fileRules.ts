export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const FILE_EMPTY_MESSAGE = "Файл исследования пустой.";

export const FILE_TOO_LARGE_MESSAGE =
  "Файл слишком большой. Максимальный размер - 50 МБ.";

export const FILE_TYPE_MESSAGE =
  "Некорректный формат файла. Ожидается DICOM (.dcm / .dicom).";

export const ANALYSIS_ERROR_MESSAGE = "Ошибка обработки ML.";

export const RESULT_NOT_READY_MESSAGE = "Результат анализа ещё не готов.";

export const FOLDER_MESSAGE =
  "Папка не поддерживается. Выберите один DICOM-файл.";

export const MULTIPLE_FILES_MESSAGE = "Можно загрузить только один DICOM-файл.";

const ALLOWED_EXTENSIONS = new Set([".dcm", ".dicom"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/dicom",
  "application/x-dicom",
]);

export function isAllowedDicomUpload(originalName: string, mimeType: string): boolean {
  const lowerName = originalName.toLowerCase();
  const extension = lowerName.includes(".")
    ? lowerName.slice(lowerName.lastIndexOf("."))
    : "";
  const mime = (mimeType ?? "").toLowerCase();

  if (ALLOWED_EXTENSIONS.has(extension)) {
    return true;
  }

  return ALLOWED_MIME_TYPES.has(mime);
}

export function dicomRejection(file: File): string | null {
  if (file.size === 0) return FILE_EMPTY_MESSAGE;
  if (file.size > MAX_FILE_BYTES) return FILE_TOO_LARGE_MESSAGE;
  if (!isAllowedDicomUpload(file.name, file.type)) return FILE_TYPE_MESSAGE;
  return null;
}
