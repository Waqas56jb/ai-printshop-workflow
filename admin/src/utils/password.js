export function generateTempPassword(name = '') {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toLowerCase())
      .join('')
      .slice(0, 2) || 'xx';
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `Shop-${n}-${initials}`;
}

export function shortUid(uid = '') {
  if (!uid) return '';
  if (uid.length <= 14) return uid;
  return `${uid.slice(0, 8)}…${uid.slice(-4)}`;
}
