export const CUSTOMER_FOLDERS_ROOT = 'P:\\CUSTOMER FOLDERS';

export function normalizeNetworkPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\+/g, '\\');
}

export function sanitizeFolderSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function defaultNetworkFolder(customer) {
  const label = (sanitizeFolderSegment(customer?.company || customer?.name) || 'CUSTOMER').toUpperCase();
  return `${CUSTOMER_FOLDERS_ROOT}\\${label}`;
}

export function resolveNetworkFolder(customer, override) {
  return (
    normalizeNetworkPath(override) ||
    normalizeNetworkPath(customer?.network_folder) ||
    defaultNetworkFolder(customer)
  );
}
