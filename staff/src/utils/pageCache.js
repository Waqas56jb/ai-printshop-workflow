const memory = new Map();

function storageKey(key) {
  return `ps-cache:${key}`;
}

export function readCache(key, maxAgeMs = 5 * 60_000) {
  if (memory.has(key)) {
    const row = memory.get(key);
    if (Date.now() - row.at <= maxAgeMs) return row.data;
  }
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const row = JSON.parse(raw);
    if (!row || Date.now() - row.at > maxAgeMs) return null;
    memory.set(key, row);
    return row.data;
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  const row = { at: Date.now(), data };
  memory.set(key, row);
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(row));
  } catch {
    // ignore quota
  }
}

export function clearCache(key) {
  memory.delete(key);
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

export function clearCachePrefix(prefix) {
  for (const key of [...memory.keys()]) {
    if (key === prefix || key.startsWith(`${prefix}:`) || key.startsWith(prefix)) {
      memory.delete(key);
    }
  }
  try {
    const remove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('ps-cache:')) continue;
      const raw = key.slice('ps-cache:'.length);
      if (raw === prefix || raw.startsWith(`${prefix}:`) || raw.startsWith(prefix)) {
        remove.push(key);
      }
    }
    remove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}
