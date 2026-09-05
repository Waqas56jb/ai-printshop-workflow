import { Link } from 'react-router-dom';

export function BoardColumns({ stages, counts, onToggle }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Columns</h3>
        <p>Order follows workflow</p>
      </div>
      <div className="cols-list">
        {stages.map((stage) => (
          <div className="colrow" key={stage.id}>
            <i style={{ background: stage.color }}></i>
            <span>{stage.name}</span>
            <span className="n num">{counts[stage.id] ?? 0}</span>
            <span
              className={`toggle${stage.show_on_board !== false ? ' on' : ''}`}
              onClick={() => onToggle(stage)}
            ></span>
          </div>
        ))}
      </div>
      <div className="foot-link">
        Reorder or rename in <Link to="/stages">Workflow stages</Link>
      </div>
    </div>
  );
}
