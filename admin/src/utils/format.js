export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '•';
}

export function stageSlug(name = '') {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function quoteTranscript(text = '') {
  const trimmed = text.trim();
  if (!trimmed) return '""';
  return trimmed.startsWith('"') ? trimmed : `"${trimmed}"`;
}

export function formatMoney(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return '—';
  return `Rs ${Math.round(amount).toLocaleString('en-US')}`;
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || name;
}

export function formatSpent(value) {
  const amount = Number(value) || 0;
  if (amount >= 1000) return `Rs ${Math.round(amount / 1000)}k`;
  return `Rs ${Math.round(amount)}`;
}
