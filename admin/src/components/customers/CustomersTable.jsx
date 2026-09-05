import { Plus } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { Pagination } from '../ui/Pagination.jsx';
import { formatLastActivity } from '../../utils/date.js';

export function CustomersTable({
  customers = [],
  loading,
  selectedId,
  onSelect,
  onNewJob,
  page,
  total,
  limit,
  onPage,
}) {
  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Contact</th>
            <th>Active jobs</th>
            <th>Total</th>
            <th>Last job</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={6}>
                    <div className="skel skel-row" />
                  </td>
                </tr>
              ))
            : customers.map((customer) => {
                const active = customer.active_jobs || [];
                return (
                  <tr
                    key={customer.id}
                    className={selectedId === customer.id ? 'selected' : ''}
                    onClick={() => onSelect(customer)}
                  >
                    <td>
                      <div className="who">
                        <Avatar name={customer.name} />
                        <div>
                          <div className="n">{customer.name}</div>
                          <div className="c">{customer.company ? 'Company' : 'Individual'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="contact">
                      {customer.phone || '—'}
                      <br />
                      {customer.email || '—'}
                    </td>
                    <td>
                      {active.length ? (
                        <div className="active-jobs">
                          {active.map((job) => (
                            <span
                              key={job.job_id}
                              className="dot"
                              style={{ background: job.stage_color || '#8A93A1' }}
                              title={job.stage_name || job.job_number}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">{customer.total_jobs ?? 0}</td>
                    <td className="muted">{formatLastActivity(customer.last_job_at)}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="icon-btn" title="New job" onClick={() => onNewJob(customer)}>
                        <Plus />
                      </button>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
      <Pagination page={page} total={total} limit={limit} onPage={onPage} noun="" />
    </div>
  );
}
