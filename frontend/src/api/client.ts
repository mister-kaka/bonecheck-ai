import { getOrCreateSessionId } from './session';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type StudyStatus = 'uploaded' | 'processing' | 'completed' | 'error';

export type CreateStudyResponse = {
  id: string;
  status: StudyStatus;
  createdAt: string;
  sessionId: string | null;
};

export type StudyStatusResponse = {
  id: string;
  sessionId: string | null;
  status: StudyStatus;
  originalFileName: string;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  hasResult: boolean;
};

export type StudyListResponse = {
  items: StudyStatusResponse[];
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (typeof body.message === 'string' && body.message) {
        message = body.message;
      }
    } catch {
      // The error body is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function createStudy(file: File): Promise<CreateStudyResponse> {
  const body = new FormData();
  body.append('file', file);
  body.append('session_id', getOrCreateSessionId());

  const response = await fetch(`${API_BASE_URL}/api/studies`, {
    method: 'POST',
    body,
  });
  return parseResponse<CreateStudyResponse>(response);
}

export async function listStudies(sessionId?: string): Promise<StudyListResponse> {
  const params = new URLSearchParams();
  if (sessionId) {
    params.set('session_id', sessionId);
  }

  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/api/studies${query ? `?${query}` : ''}`);
  return parseResponse<StudyListResponse>(response);
}

export function listMyStudies(): Promise<StudyListResponse> {
  return listStudies(getOrCreateSessionId());
}

export function listAllStudies(): Promise<StudyListResponse> {
  return listStudies();
}
