import { stageSlug } from '../../utils/format.js';

export function Chip({ stage, children }) {
  const slug = stageSlug(stage);
  return <span className={`chip ${slug}`}>{children || stage}</span>;
}
