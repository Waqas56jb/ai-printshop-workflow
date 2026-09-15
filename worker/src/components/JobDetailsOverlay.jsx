function formatPrice(price, currency = '') {
  if (price == null || price === '') return '—';
  return `${currency ? `${currency} ` : ''}${price}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function JobDetailsOverlay({ job, onBack, onArtwork }) {
  if (!job) return null;
  const details = job.details || {};
  const artworks = job.artworks || [];
  const dueClass = /overdue/i.test(job.due_label || '')
    ? 'over'
    : /today/i.test(job.due_label || '')
      ? 'today'
      : '';

  return (
    <div className="details-overlay" role="dialog" aria-label={`Details for ${job.job_number}`}>
      <div className="details-panel">
        <div className="details-col left">
          <span className="details-jn">{job.job_number}</span>
          <h1>{job.customer_name || 'No customer'}</h1>
          <p className="details-title">{job.title}</p>
          <div className="details-qty num">{job.quantity ?? '—'}</div>
          <span className="details-qty-label">Quantity</span>

          <dl className="details-rows">
            <div>
              <dt>Print type</dt>
              <dd>{details.print_type || '—'}</dd>
            </div>
            <div>
              <dt>Product type</dt>
              <dd>{details.product_type || '—'}</dd>
            </div>
            <div>
              <dt>Size / notes</dt>
              <dd className="pre">{details.size_details || '—'}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{formatPrice(details.price)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(details.created_at)}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd>{job.assigned_initials || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="details-col right">
          <div className="details-stage-track">
            <span className="k">Current stage</span>
            <span className="details-stage-chip" style={{ '--stage': job.stage_color }}>
              {job.stage_name}
            </span>
          </div>
          <div className={`details-due ${dueClass}`}>
            <span className="k">Due</span>
            <span className="v">{job.due_label || '—'}</span>
          </div>
          {job.priority ? (
            <div className="details-priority">
              <span className="k">Priority</span>
              <span className={`prio ${job.priority}`}>{job.priority}</span>
            </div>
          ) : null}
        </div>

        <div className="details-artworks">
          {artworks.length ? (
            artworks.map((art, index) => (
              <button
                type="button"
                key={art.url || index}
                className={`thumb${art.is_approved ? ' approved' : ''}`}
                onClick={() => onArtwork?.(index)}
              >
                {/\.(png|jpe?g|gif|webp)$/i.test(art.url || '') ? (
                  <img src={art.url} alt={art.name || 'artwork'} />
                ) : (
                  <span className="thumb-file">{art.name || 'File'}</span>
                )}
              </button>
            ))
          ) : (
            <span className="hint muted">No artwork uploaded</span>
          )}
        </div>

        <button type="button" className="ghost-btn back" onClick={() => onBack?.()}>
          Back <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
