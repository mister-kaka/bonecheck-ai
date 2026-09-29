import { getOrCreateSessionId } from "./session";
import type {
  StudyListItem,
  StudyResultPayload,
  StudyStatus,
} from "../types/study";

export type { StudyListItem, StudyResultPayload, StudyStatus };

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export type CreateStudyResponse = {
  id: string;
  status: StudyStatus;
  createdAt: string;
  sessionId: string | null;
};

export type StudyListResponse = {
  items: StudyListItem[];
};

export type PackageCreatedItem = CreateStudyResponse & {
  originalFileName: string;
};

export type CreatePackageResponse = {
  items: PackageCreatedItem[];
};

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;
  readonly studyStatus: StudyStatus | undefined;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    studyStatus?: StudyStatus,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.code = code;
    this.studyStatus = studyStatus;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.";

export function messageFromError(
  error: unknown,
  fallback = NETWORK_ERROR_MESSAGE,
): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

function errorFromBody(status: number, raw: string): ApiRequestError {
  let message = "Не удалось выполнить запрос. Попробуйте ещё раз.";
  let code: string | undefined;
  let studyStatus: StudyStatus | undefined;

  if (status === 0) {
    message = NETWORK_ERROR_MESSAGE;
  } else if (status === 413) {
    message = "Файл слишком большой. Максимальный размер - 50 МБ.";
  } else if (status >= 500) {
    message = "Не удалось обработать запрос. Попробуйте ещё раз.";
  }

  try {
    const body = JSON.parse(raw) as {
      message?: unknown;
      code?: unknown;
      status?: unknown;
    };
    if (typeof body.message === "string" && body.message.trim() && !isTechnicalMessage(body.message)) {
      message = body.message.trim();
    }
    if (typeof body.code === "string") code = body.code;
    if (typeof body.status === "string") studyStatus = body.status as StudyStatus;
  } catch {
    const plain = raw.trim();
    if (
      plain &&
      plain.length <= 240 &&
      !plain.startsWith("<") &&
      !plain.startsWith("{") &&
      status < 500 &&
      !isTechnicalMessage(plain)
    ) {
      message = plain;
    }
  }

  return new ApiRequestError(status, message, code, studyStatus);
}

function isTechnicalMessage(message: string): boolean {
  return /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i.test(message.trim())
    || /\b(ENOENT|ECONNREFUSED|ECONNRESET|SQLITE_|TypeError|ReferenceError)\b/.test(message);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!response.ok) {
    throw errorFromBody(response.status, raw);
  }
  if (!raw) {
    throw new ApiRequestError(response.status, "Пустой ответ сервера.");
  }
  return JSON.parse(raw) as T;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { signal: combined });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) {
      throw new ApiRequestError(0, "Сервер не ответил вовремя. Попробуйте ещё раз.", "TIMEOUT");
    }
    throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE, "NETWORK");
  }
  return parseResponse<T>(response);
}

function postMultipart<T>(
  path: string,
  file: File,
  signal?: AbortSignal,
  onUploadProgress?: (ratio: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    const body = new FormData();
    body.append("file", file);
    body.append("session_id", getOrCreateSessionId());

    const failAbort = () => xhr.abort();
    signal?.addEventListener("abort", failAbort, { once: true });

    const finish = () => {
      signal?.removeEventListener("abort", failAbort);
    };

    xhr.upload.onprogress = (event) => {
      if (!onUploadProgress || !event.lengthComputable || event.total <= 0) return;
      onUploadProgress(Math.min(1, event.loaded / event.total));
    };

    xhr.onload = () => {
      finish();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ApiRequestError(xhr.status, "Пустой ответ сервера."));
        }
        return;
      }
      reject(errorFromBody(xhr.status, xhr.responseText));
    };

    xhr.onerror = () => {
      finish();
      reject(new ApiRequestError(0, NETWORK_ERROR_MESSAGE, "NETWORK"));
    };

    xhr.ontimeout = () => {
      finish();
      reject(new ApiRequestError(0, "Сервер не ответил вовремя. Попробуйте ещё раз.", "TIMEOUT"));
    };

    xhr.onabort = () => {
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };

    xhr.send(body);
  });
}

export function createStudy(
  file: File,
  signal?: AbortSignal,
  onUploadProgress?: (ratio: number) => void,
): Promise<CreateStudyResponse> {
  return postMultipart<CreateStudyResponse>(
    "/api/studies",
    file,
    signal,
    onUploadProgress,
  );
}

export function createStudyPackage(
  file: File,
  signal?: AbortSignal,
  onUploadProgress?: (ratio: number) => void,
): Promise<CreatePackageResponse> {
  return postMultipart<CreatePackageResponse>(
    "/api/studies/packages",
    file,
    signal,
    onUploadProgress,
  );
}

export function listStudies(
  sessionId?: string,
  signal?: AbortSignal,
): Promise<StudyListResponse> {
  const params = new URLSearchParams();
  if (sessionId) {
    params.set("session_id", sessionId);
  }

  const query = params.toString();
  return fetchJson<StudyListResponse>(
    `${API_BASE_URL}/api/studies${query ? `?${query}` : ""}`,
    signal,
  );
}

export function getStudy(id: string, signal?: AbortSignal): Promise<StudyListItem> {
  return fetchJson<StudyListItem>(`${API_BASE_URL}/api/studies/${id}`, signal);
}

export function getStudyResult(
  id: string,
  signal?: AbortSignal,
): Promise<StudyResultPayload> {
  return fetchJson<StudyResultPayload>(
    `${API_BASE_URL}/api/studies/${id}/result`,
    signal,
  );
}

export async function getStudyFile(id: string, signal?: AbortSignal): Promise<Blob> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/studies/${id}/file`, { signal: combined });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) {
      throw new ApiRequestError(0, "Сервер не ответил вовремя. Попробуйте ещё раз.", "TIMEOUT");
    }
    throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE, "NETWORK");
  }

  if (!response.ok) {
    await parseResponse<never>(response);
  }

  return response.blob();
}

export async function downloadStudiesXlsx(options: {
  ids?: string[];
  sessionId?: string;
}): Promise<void> {
  await downloadAttachment("/api/studies/export", options, "bonecheck-history.xlsx");
}

export async function downloadSubmission(options: {
  ids?: string[];
  sessionId?: string;
}): Promise<void> {
  await downloadAttachment("/api/studies/submission", options, "bonecheck-submission.xlsx");
}

async function downloadAttachment(
  path: string,
  options: { ids?: string[]; sessionId?: string },
  fallbackName: string,
): Promise<void> {
  const params = new URLSearchParams();
  if (options.ids && options.ids.length > 0) {
    params.set("ids", options.ids.join(","));
  }
  if (options.sessionId) {
    params.set("session_id", options.sessionId);
  }

  const query = params.toString();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}${path}${query ? `?${query}` : ""}`,
      { signal: timeout },
    );
  } catch (error) {
    if (timeout.aborted) {
      throw new ApiRequestError(0, "Сервер не ответил вовремя. Попробуйте ещё раз.", "TIMEOUT");
    }
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE, "NETWORK");
  }

  if (!response.ok) {
    await parseResponse<never>(response);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackName,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header: string | null, fallbackName: string): string {
  const match = header ? /filename="([^"]+)"/.exec(header) : null;
  return match?.[1] || fallbackName;
}
