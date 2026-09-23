const STORAGE_KEY = 'bonecheck_session_id';

export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, created);
  return created;
}
