export function ConfirmOverlay({ data, onSelect, onCancel }) {
  if (!data) return null;
  const candidates = data.candidates || [];

  return (
    <div className="confirm-overlay" role="dialog" aria-label="Confirm which job">
      <div className="confirm-panel">
        <p className="confirm-prompt">{data.prompt}</p>
        <div className="confirm-candidates">
          {candidates.map((job) => (
            <button type="button" key={job.job_id} className="confirm-candidate" onClick={() => onSelect?.(job.job_id)}>
              <span className="jn">{job.job_number}</span>
              <span className="cust">{job.customer_name}</span>
              <span className="title">{job.title}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ghost-btn back" onClick={() => onCancel?.()}>
          Cancel
        </button>
      </div>
    </div>
  );
}
