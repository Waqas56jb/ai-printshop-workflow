export function CustomerStats({ stats }) {
  const total = stats?.total ?? 0;
  const fresh = stats?.new_this_month ?? 0;
  const withActive = stats?.with_active_jobs ?? 0;
  const activeJobs = stats?.active_jobs_count ?? 0;
  const repeat = stats?.repeat_percent ?? 0;

  return (
    <div className="stats">
      <div className="stat">
        <div className="k">Customers</div>
        <div className="v num">{total}</div>
        <div className="d">{fresh} new this month</div>
      </div>
      <div className="stat">
        <div className="k">With active jobs</div>
        <div className="v num">{withActive}</div>
        <div className="d">
          {activeJobs} job{activeJobs === 1 ? '' : 's'} in progress
        </div>
      </div>
      <div className="stat">
        <div className="k">Repeat customers</div>
        <div className="v num">{repeat}%</div>
        <div className="d">2+ jobs delivered</div>
      </div>
    </div>
  );
}
