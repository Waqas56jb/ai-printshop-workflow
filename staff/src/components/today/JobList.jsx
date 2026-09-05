import { JobCard } from './JobCard.jsx';

const TABS = [
  { id: 'mine', label: 'Mine' },
  { id: 'due', label: 'Due today' },
  { id: 'all', label: 'All active' },
];

export function JobList({ tab, onTab, counts, jobs, onAssign, onChanged, onError }) {
  return (
    <section className="panel">
      <div className="tabs">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'on' : ''} onClick={() => onTab(item.id)}>
            {item.label} <b>{counts[item.id] ?? 0}</b>
          </button>
        ))}
      </div>
      <div className="jobs">
        {jobs.length ? (
          jobs.map((job) => (
            <JobCard key={job.id} job={job} onAssign={onAssign} onChanged={onChanged} onError={onError} />
          ))
        ) : (
          <div className="empty">No jobs in this list</div>
        )}
      </div>
    </section>
  );
}
