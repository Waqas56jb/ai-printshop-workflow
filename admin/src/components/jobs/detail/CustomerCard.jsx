import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../ui/Avatar.jsx';
import { listJobs } from '../../../services/jobs.service.js';

export function CustomerCard({ customer }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!customer?.id) return;
    listJobs({ customer: customer.id, limit: 1 }).then((data) => {
      const total = data.total ?? data.count ?? data.jobs?.length ?? 0;
      setCount(Math.max(0, total - 1));
    });
  }, [customer?.id]);

  if (!customer) return null;

  return (
    <section className="panel">
      <div className="cust">
        <Avatar name={customer.name} />
        <div>
          <div className="n">{customer.name}</div>
          <div className="c">
            {[customer.phone, customer.email].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="c">{count == null ? '…' : `${count} previous job${count === 1 ? '' : 's'}`}</div>
        </div>
        <Link to={`/customers/${customer.id}`}>View</Link>
      </div>
    </section>
  );
}
