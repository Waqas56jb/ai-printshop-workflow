export function ProductionLine({ stages = [], overdueByStage = {}, activeCount = 0, completedThisWeek = 0 }) {
  return (
    <section className="line">
      <div className="line-head">
        <h2>Production line</h2>
        <p>{activeCount} active jobs · updates live</p>
      </div>
      <div className="stages">
        {stages.map((stage) => {
          const overdue = overdueByStage[stage.stage_id] || 0;
          const isFinal = /deliver/i.test(stage.name);
          return (
            <div key={stage.stage_id} className="stage" style={{ '--stage': stage.color || '#8A93A1' }}>
              <div className="knob"></div>
              <div className="count num">{stage.count ?? 0}</div>
              <div className="label">{stage.name}</div>
              {overdue > 0 ? <div className="late">{overdue} overdue</div> : null}
              {isFinal && !overdue ? (
                <div className="late" style={{ color: 'var(--ink-3)' }}>
                  {completedThisWeek} this week
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
