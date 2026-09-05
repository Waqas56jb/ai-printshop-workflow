export function BoardPreview({ stages = [], counts = {} }) {
  const visible = stages.filter((stage) => stage.show_on_board !== false);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Job board preview</h3>
        <p>Columns shown on the shop screen, in this order</p>
      </div>
      <div className="preview">
        {visible.map((stage) => {
          const n = counts[stage.id] || 0;
          return (
            <div key={stage.id} className="pcol" style={{ '--c': stage.color }}>
              {stage.name}
              {Array.from({ length: n }).map((_, index) => (
                <i key={index} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
