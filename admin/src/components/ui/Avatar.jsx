import { initials } from '../../utils/format.js';

export function Avatar({ name, className = '' }) {
  return <div className={`avatar ${className}`.trim()}>{initials(name)}</div>;
}
