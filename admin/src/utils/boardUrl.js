export function workerBaseUrl() {
  return (import.meta.env.VITE_WORKER_URL || 'http://localhost:5175').replace(/\/$/, '');
}

export function workerBoardUrl({ key = '', preview = false, label = '' } = {}) {
  const params = new URLSearchParams();
  if (key) params.set('key', key);
  if (preview) params.set('preview', '1');
  if (label) params.set('label', label);
  const query = params.toString();
  return query ? `${workerBaseUrl()}/?${query}` : `${workerBaseUrl()}/`;
}

export function formatClockTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
