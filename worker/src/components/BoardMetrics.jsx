function Ring({ value, total, color, label }) {
  const safe = Math.max(0, Number(value) || 0);
  const max = Math.max(1, Number(total) || 1);
  const pct = Math.min(1, safe / max);
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="ring-track" cx="22" cy="22" r={r} />
        <circle
          className="ring-val"
          cx="22"
          cy="22"
          r={r}
          style={{
            stroke: color,
            strokeDasharray: `${pct * c} ${c}`,
          }}
        />
      </svg>
      <div className="ring-copy">
        <b className="num">{safe}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function BoardMetrics({ stages = [], summary = {} }) {
  const counts = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    color: stage.color || '#7C8593',
    n: stage.jobs?.length || 0,
  }));
  const total = counts.reduce((sum, row) => sum + row.n, 0);
  const inProgress = summary.in_progress ?? total;
  const dueToday = summary.due_today ?? 0;
  const overdue = summary.overdue ?? 0;
  const delivered = summary.delivered_this_week ?? 0;

  return (
    <div className="metrics">
      <div className="pipe">
        <div className="pipe-head">
          <span>Pipeline</span>
          <b className="num">{total} jobs</b>
        </div>
        <div className={`pipe-track${total ? '' : ' empty'}`}>
          {total
            ? counts.map((row) => (
                <i
                  key={row.id}
                  title={`${row.name}: ${row.n}`}
                  style={{
                    flexGrow: row.n || 0.15,
                    flexBasis: 0,
                    background: row.n ? row.color : 'transparent',
                    opacity: row.n ? 1 : 0.18,
                  }}
                />
              ))
            : <i className="pipe-idle" />}
        </div>
        <div className="pipe-legend">
          {counts.map((row) => (
            <span key={row.id}>
              <i style={{ background: row.color }} />
              {row.name}
              <em className="num">{row.n}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="rings">
        <Ring value={inProgress} total={Math.max(total, inProgress, 1)} color="var(--cyan)" label="in progress" />
        <Ring value={dueToday} total={Math.max(inProgress, dueToday, 1)} color="var(--amber)" label="due today" />
        <Ring value={overdue} total={Math.max(inProgress, overdue, 1)} color="var(--red)" label="overdue" />
        <Ring value={delivered} total={Math.max(inProgress + delivered, 1)} color="var(--green)" label="delivered" />
      </div>
    </div>
  );
}
