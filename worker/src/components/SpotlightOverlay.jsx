function initialsFallback(name) {
  return (name || '').trim().slice(0, 1).toUpperCase();
}

export function SpotlightOverlay({ job, onShowArtwork, onShowDetails, onNextStage, onPrevStage, onBack }) {
  if (!job) return null;
  const hasArtwork = (job.artworks || []).length > 0;
  const prio = job.priority === 'urgent' || job.priority === 'high' ? job.priority : null;

  return (
    <div className="spotlight-overlay" role="dialog" aria-label={`Job ${job.job_number}`}>
      <div className="spotlight-card">
        <div className="spotlight-top">
          <span className="spotlight-jn">{job.job_number}</span>
          <span className="spotlight-chip" style={{ '--stage': job.stage_color }}>
            {job.stage_name}
          </span>
          {prio ? <span className={`prio ${prio}`}>{prio === 'urgent' ? 'Urgent' : 'High'}</span> : null}
        </div>

        <h1 className="spotlight-customer">{job.customer_name || 'No customer'}</h1>
        <p className="spotlight-title">{job.title}</p>

        <div className="spotlight-stats">
          <div className="stat">
            <span className="k">Qty</span>
            <span className="v num">{job.quantity ?? '—'}</span>
          </div>
          <div className="stat">
            <span className="k">Due</span>
            <span className="v">{job.due_label || '—'}</span>
          </div>
          <div className="stat">
            <span className="k">Assigned</span>
            <span className="v">{job.assigned_initials || initialsFallback(job.customer_name) || '—'}</span>
          </div>
        </div>

        <div className="spotlight-stage-nav">
          <button
            type="button"
            className="stage-btn prev"
            disabled={!job.prev_stage}
            onClick={() => onPrevStage?.()}
          >
            ← Back to {job.prev_stage?.name || '—'}
          </button>
          <button
            type="button"
            className="stage-btn next"
            disabled={!job.next_stage}
            onClick={() => onNextStage?.()}
          >
            Move to {job.next_stage?.name || '—'} →
          </button>
        </div>

        <div className="spotlight-bottom">
          {hasArtwork ? (
            <button type="button" className="ghost-btn" onClick={() => onShowArtwork?.()}>
              Show artwork
            </button>
          ) : (
            <span className="hint muted">No artwork uploaded</span>
          )}
          <button type="button" className="ghost-btn" onClick={() => onShowDetails?.()}>
            More details
          </button>
          <button type="button" className="ghost-btn back" onClick={() => onBack?.()}>
            Back to board <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
