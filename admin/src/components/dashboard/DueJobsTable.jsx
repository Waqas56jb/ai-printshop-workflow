import { Link } from 'react-router-dom';
import { Chip } from '../ui/Chip.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Panel } from '../ui/Panel.jsx';
import { dueTone, formatDueLabel } from '../../utils/date.js';

export function DueJobsTable({ jobs = [], empty }) {
  return (
    <Panel title="Due in the next 3 days" actionTo="/jobs" actionLabel="All jobs">
      {empty ? (
        <EmptyState />
      ) : jobs.length === 0 ? (
        <div className="empty">
          <p>No jobs due in the next 3 days.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Customer</th>
              <th>Stage</th>
              <th>Qty</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <span className={`prio ${job.priority || 'normal'}`}></span>
                  <Link className="job-no" to={`/jobs/${job.id}`}>
                    {job.job_number}
                  </Link>
                </td>
                <td>
                  <div>{job.customer?.name || '—'}</div>
                  <div className="cust">{job.title}</div>
                </td>
                <td>
                  <Chip stage={job.stage?.name || job.stage?.slug}>{job.stage?.name}</Chip>
                </td>
                <td className="num">{job.quantity}</td>
                <td className={`due ${dueTone(job.due_date)}`}>{formatDueLabel(job.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
