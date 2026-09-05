export function StageTabs({ stages = [], counts = {}, activeId, onChange }) {
  const activeCount = counts.active ?? 0;

  return (
    <div className="tabs">
      <button type="button" className={`tab ${!activeId ? 'active' : ''}`} onClick={() => onChange('')}>
        <i style={{ '--stage': '#161A1F' }}></i>
        All active <b>{activeCount}</b>
      </button>
      {stages.map((stage) => (
        <button
          key={stage.id}
          type="button"
          className={`tab ${activeId === stage.id || (stage.is_final && activeId === 'delivered') ? 'active' : ''}`}
          onClick={() => onChange(stage.is_final ? 'delivered' : stage.id)}
        >
          <i style={{ '--stage': stage.color || '#8A93A1' }}></i>
          {stage.name} <b>{counts[stage.is_final ? 'completed' : stage.id] ?? 0}</b>
        </button>
      ))}
    </div>
  );
}
