import { dueLine, fileExt, isImageFile } from '../../utils/plain.js';

const MAX_THUMBS = 3;

function Thumbs({ files }) {
  if (!files?.length) return null;
  // Pictures first (they say the most at a glance), newest first within each group.
  const sorted = [...files].sort(
    (a, b) => isImageFile(b) - isImageFile(a) || new Date(b.created_at) - new Date(a.created_at)
  );
  const shown = sorted.slice(0, MAX_THUMBS);
  const extra = sorted.length - shown.length;
  return (
    <div className="card-thumbs">
      {shown.map((file) =>
        isImageFile(file) ? (
          <img key={file.id} src={file.file_url} alt={file.file_name} loading="lazy" />
        ) : (
          <span key={file.id} className="t" title={file.file_name}>
            {fileExt(file)}
          </span>
        )
      )}
      {extra > 0 ? <span className="more">+{extra}</span> : null}
    </div>
  );
}

// One job, one big button: "→ {next stage}" or "Done ✓" on the last stage.
export function JobCard({ job, action, busy, onOpen, onAction }) {
  const due = dueLine(job);

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(job)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(job);
      }}
    >
      <div className="card-no">
        {job.job_number} · {job.title}
      </div>
      {job.customer?.name ? <div className="card-customer">{job.customer.name}</div> : null}
      <Thumbs files={job.artworks} />
      <div className={`card-due ${due.tone}`}>{due.text}</div>
      {action ? (
        <button
          type="button"
          className={`card-next${action.done ? ' done' : ''}`}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onAction(job);
          }}
        >
          {busy ? 'One moment…' : action.label}
        </button>
      ) : null}
    </div>
  );
}
