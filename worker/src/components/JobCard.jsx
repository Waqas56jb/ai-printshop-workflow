import { useEffect, useRef, useState } from 'react';
import { formatDueLabel } from '../utils/date.js';

function ArtIcon({ approved }) {
  if (approved) {
    return (
      <svg viewBox="0 0 24 24">
        <path d="m5 12 5 5L20 7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

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

  let art = null;
  if (job.has_approved_artwork) {
    art = (
      <span className="art ok">
        <ArtIcon approved />
        approved
      </span>
    );
  } else if (job.artworks_count > 0) {
    art = (
      <span className="art">
        <ArtIcon />
        {job.artworks_count}
      </span>
    );
  } else {
    art = (
      <span className="art no">
        <ArtIcon />
        no art
      </span>
    );
  }

  return (
    <div className={classes.join(' ')}>
      {prio ? <span className={`prio ${prio}`}>{prio === 'urgent' ? 'Urgent' : 'High'}</span> : null}
      <div className="l1">
        <span className="jn">{job.job_number}</span>
        {showCustomer && job.customer_name ? <span className="cust">{job.customer_name}</span> : null}
      </div>
      <div className="title">{job.title}</div>
      <div className="l3">
        {job.assigned_initials ? <span className="who">{job.assigned_initials}</span> : null}
        <span className="qty num">{job.quantity}</span>
        {art}
        {showDue && due ? <span className="due">{due}</span> : null}
      </div>
    </div>
  );
}
