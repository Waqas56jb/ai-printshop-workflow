export function Kpis({ counts }) {
  return (
    <div className="kpis">
      <div className={`kpi ${(counts?.overdue || 0) > 0 ? 'warn' : ''}`.trim()}>
        <div className="k">Overdue</div>
        <div className="v num">{counts?.overdue ?? 0}</div>
      </div>
      <div className="kpi">
        <div className="k">Due today</div>
        <div className="v num">{counts?.due_today ?? 0}</div>
      </div>
      <div className="kpi">
        <div className="k">Done by me this week</div>
        <div className="v num">{counts?.done_by_me_week ?? 0}</div>
      </div>
    </div>
  );
}
