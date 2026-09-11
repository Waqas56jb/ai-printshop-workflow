import { Button } from '../../ui/Button.jsx';
import { formatJobAge, formatShortDate } from '../../../utils/date.js';
import { firstName, formatMoney } from '../../../utils/format.js';

export function JobDetails({ job, onEdit, users = [] }) {
  const creator = users.find((user) => user.id === job.created_by);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Details</h3>
        <Button variant="ghost" className="btn-sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="dl">
        <div>
          <dt>Product</dt>
          <dd>{job.product_type || '—'}</dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd className="num">{job.quantity ?? '—'}</dd>
        </div>
        <div>
          <dt>Print type</dt>
          <dd>{job.print_type || '—'}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd className="num">{job.price != null && job.price !== '' ? formatMoney(job.price) : '—'}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{job.due_date ? formatShortDate(`${job.due_date}`.slice(0, 10)) : '—'}</dd>
        </div>
        <div>
          <dt>Assigned</dt>
          <dd>{job.assignee?.full_name || 'Unassigned'}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{job.priority ? job.priority[0].toUpperCase() + job.priority.slice(1) : '—'}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            {formatShortDate(job.created_at)}
            {creator ? ` by ${firstName(creator.full_name)}` : ''}
          </dd>
        </div>
        <div>
          <dt>Job age</dt>
          <dd>{formatJobAge(job.created_at)}</dd>
        </div>
        <div className="wide">
          <dt>Size / print details</dt>
          <dd className="pre">{job.size_details || (typeof job.notes === 'string' ? job.notes : '') || '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
