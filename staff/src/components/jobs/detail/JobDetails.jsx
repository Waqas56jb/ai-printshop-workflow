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
          <dd className="num">{job.price != null ? formatMoney(job.price) : '—'}</dd>
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
          <dd className="pre">{job.size_details || '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
