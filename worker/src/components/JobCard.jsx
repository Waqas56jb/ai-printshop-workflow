import { useEffect, useRef, useState } from 'react';
import { formatDueLabel } from '../utils/date.js';

export function JobCard({ job, stageId, stageName, settings, prevJobs }) {
  const [moved, setMoved] = useState(false);
  const timer = useRef(null);
  const map = prevJobs;

  useEffect(() => {
    if (!map?.current) return undefined;
    const last = map.current.get(job.id);
    map.current.set(job.id, { stageId, updated_at: job.updated_at });
    if (!last) return undefined;
    if (last.stageId === stageId && last.updated_at === job.updated_at) return undefined;
    setMoved(true);
    timer.current = setTimeout(() => setMoved(false), 1800);
    return () => clearTimeout(timer.current);
  }, [job.id, job.updated_at, stageId, map]);

  const ready = /ready/i.test(stageName || '');
  const showCustomer = settings?.show_customer !== false;
  const showDue = settings?.show_due !== false;
  const flashOverdue = Boolean(settings?.overdue_highlight && job.is_overdue);

  const classes = ['card'];
  if (job.is_overdue) classes.push('over');
  else if (job.is_due_today) classes.push('today');
  if (flashOverdue) classes.push('flash');
  if (moved) classes.push('moved');

  const prio = job.priority === 'urgent' || job.priority === 'high' ? job.priority : null;
  const due = formatDueLabel(job.due_date, { ready });
  const customer = job.customer_name || 'No customer';
  const orderType = job.product_type || job.title || '—';
  const qty = job.quantity == null || job.quantity === '' ? '—' : `×${job.quantity}`;
  const status = job.stage_name || stageName || '—';

  return (
    <article className={classes.join(' ')}>
      <div className="card-top">
        <span className="jn">{job.job_number}</span>
        {prio ? <span className={`prio ${prio}`}>{prio === 'urgent' ? 'Urgent' : 'High'}</span> : null}
      </div>

      {showCustomer ? (
        <div className="cust" title={customer}>
          {customer}
        </div>
      ) : null}

      <div className="card-rows">
        <div className="card-row">
          <span className="k">Type</span>
          <span className="v" title={orderType}>
            {orderType}
          </span>
        </div>
        <div className="card-row">
          <span className="k">Qty</span>
          <span className="v qty num">{qty}</span>
        </div>
        {showDue ? (
          <div className="card-row">
            <span className="k">Due</span>
            <span className={`v due${due ? '' : ' muted'}`}>{due || '—'}</span>
          </div>
        ) : null}
        <div className="card-row">
          <span className="k">Status</span>
          <span className="v status">{status}</span>
        </div>
      </div>
    </article>
  );
}
