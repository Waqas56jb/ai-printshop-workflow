import { dueLine } from '../../utils/plain.js';

const ACTIONS = {
  new: { label: 'Start work →', className: 'btn btn-primary btn-block' },
  working: { label: 'Finished → Ready', className: 'btn btn-green btn-block' },
  ready: { label: 'Picked up ✓', className: 'btn btn-block' },
};

export function JobCard({ job, column, busy, onOpen, onAction }) {
  const due = dueLine(job, column);
  const action = ACTIONS[column];

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
      <div className="card-no">{job.job_number}</div>
      <div className="card-title">{job.title}</div>
      {job.customer?.name ? <div className="card-customer">{job.customer.name}</div> : null}
      <div className={`card-due ${due.tone}`}>{due.text}</div>
      {action ? (
        <div className="card-action">
          <button
            type="button"
            className={action.className}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onAction(job, column);
            }}
          >
            {busy ? 'One moment…' : action.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}
