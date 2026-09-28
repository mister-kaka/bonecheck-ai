export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const FILE_EMPTY_MESSAGE = "Файл исследования пустой.";

export const FILE_TOO_LARGE_MESSAGE =
  "Файл слишком большой. Максимальный размер - 50 МБ.";

export const FILE_TYPE_MESSAGE =
  "Некорректный формат файла. Ожидается DICOM (.dcm / .dicom).";

export const ANALYSIS_ERROR_MESSAGE = "Не удалось проверить качество укладки.";

export const RESULT_NOT_READY_MESSAGE = "Результат анализа ещё не готов.";

export const FOLDER_MESSAGE =
  "Папка не поддерживается. Выберите один DICOM-файл или ZIP-архив.";

export const MULTIPLE_FILES_MESSAGE =
  "Можно загрузить один DICOM-файл или один ZIP-архив.";

export const ZIP_TYPE_MESSAGE = "Ожидается ZIP-архив (.zip).";

export const ZIP_EMPTY_MESSAGE = "Архив пустой.";

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

export function isZipFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".zip")) return true;
  const mime = (file.type ?? "").toLowerCase();
  return mime === "application/zip" || mime === "application/x-zip-compressed";
}

export function zipRejection(file: File): string | null {
  if (file.size === 0) return ZIP_EMPTY_MESSAGE;
  if (file.size > MAX_FILE_BYTES) return FILE_TOO_LARGE_MESSAGE;
  if (!isZipFile(file)) return ZIP_TYPE_MESSAGE;
  return null;
}
