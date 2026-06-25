const SAVED_QUERY_IDS_KEY = 'sql-ai-assistant:saved-query-ids';

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readSavedQueryIds() {
  if (!storageAvailable()) return [];

  try {
    const raw = window.localStorage.getItem(SAVED_QUERY_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeSavedQueryIds(ids: string[]) {
  if (!storageAvailable()) return ids;

  const uniqueIds = [...new Set(ids)];
  window.localStorage.setItem(SAVED_QUERY_IDS_KEY, JSON.stringify(uniqueIds));
  return uniqueIds;
}

export function toggleSavedQueryId(id: string) {
  const savedIds = new Set(readSavedQueryIds());
  if (savedIds.has(id)) {
    savedIds.delete(id);
  } else {
    savedIds.add(id);
  }
  return writeSavedQueryIds([...savedIds]);
}

export function removeSavedQueryId(id: string) {
  return writeSavedQueryIds(readSavedQueryIds().filter((savedId) => savedId !== id));
}
