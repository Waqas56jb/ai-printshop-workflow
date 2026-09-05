function iconPath(name) {
  if (name === 'add_note') return 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z';
  return 'M5 12h14m-6-6 6 6-6 6';
}

function titleFor(name) {
  if (name === 'move_stage') return 'Move stage';
  if (name === 'add_note') return 'Add note';
  if (name === 'create_job') return 'Create job';
  if (name === 'assign_job') return 'Assign job';
  if (name === 'resolve_job' || name === 'get_job_status') return 'Find job';
  return name.replace(/_/g, ' ');
}

export function ToolCallCard({ tool, onPick, onCancel }) {
  const candidates = tool.candidates || [];
  const status = tool.status || (candidates.length > 1 ? 'needs' : tool.ok === false ? 'failed' : 'done');
  return (
    <div className="tool">
      <span className="ic">
        <svg viewBox="0 0 24 24">
          <path d={iconPath(tool.name)} />
        </svg>
      </span>
      <div>
        <b>{titleFor(tool.name)}</b>
        <span>{tool.detail || tool.error || 'Working…'}</span>
      </div>
      {status === 'done' ? <span className="ok">Done</span> : null}
      {status === 'needs' ? <span className="wait">Needs you</span> : null}
      {status === 'failed' ? <span className="wait">Failed</span> : null}
      {candidates.length > 1 ? (
        <div className="confirm">
          {candidates.map((job) => (
            <button key={job.id || job.job_number} type="button" className="yes" onClick={() => onPick(job)}>
              {job.job_number} {job.customer_name || job.title || ''}
            </button>
          ))}
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
