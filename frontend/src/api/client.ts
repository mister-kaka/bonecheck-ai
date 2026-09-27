import { getOrCreateSessionId } from "./session";
import type {
  StudyListItem,
  StudyResultPayload,
  StudyStatus,
} from "../types/study";

export type { StudyListItem, StudyResultPayload, StudyStatus };

/** Экраны эти функции пока не вызывают: backend не подключён. */

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

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code: string | undefined;
    let studyStatus: StudyStatus | undefined;
    try {
      const body = (await response.json()) as {
        message?: string;
        code?: string;
        status?: StudyStatus;
      };
      if (typeof body.message === "string" && body.message) {
        message = body.message;
      }
      if (typeof body.code === "string") code = body.code;
      if (typeof body.status === "string") studyStatus = body.status;
    } catch {
      // не JSON
    }
    throw new ApiRequestError(response.status, message, code, studyStatus);
  }

  return response.json() as Promise<T>;
}

export async function createStudy(file: File): Promise<CreateStudyResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("session_id", getOrCreateSessionId());

  const response = await fetch(`${API_BASE_URL}/api/studies`, {
    method: "POST",
    body,
  });
  return parseResponse<CreateStudyResponse>(response);
}

export async function listStudies(sessionId?: string): Promise<StudyListResponse> {
  const params = new URLSearchParams();
  if (sessionId) {
    params.set("session_id", sessionId);
  }

  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/api/studies${query ? `?${query}` : ""}`,
  );
  return parseResponse<StudyListResponse>(response);
}

export function listMyStudies(): Promise<StudyListResponse> {
  return listStudies(getOrCreateSessionId());
}

export function listAllStudies(): Promise<StudyListResponse> {
  return listStudies();
}

export async function getStudy(id: string): Promise<StudyListItem> {
  const response = await fetch(`${API_BASE_URL}/api/studies/${id}`);
  return parseResponse<StudyListItem>(response);
}

export async function getStudyResult(id: string): Promise<StudyResultPayload> {
  const response = await fetch(`${API_BASE_URL}/api/studies/${id}/result`);
  return parseResponse<StudyResultPayload>(response);
}
