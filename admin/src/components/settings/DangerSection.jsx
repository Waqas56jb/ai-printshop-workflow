export function DangerSection({ onExport, onClear, onRegenOmi }) {
  return (
    <div className="panel danger" id="danger">
      <div className="panel-head">
        <h3>Danger zone</h3>
      </div>
      <div className="setting">
        <div className="t">
          <b>Export all data</b>
          <span>Jobs, customers, notes as CSV</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExport}>
          Export
        </button>
      </div>
      <div className="setting">
        <div className="t">
          <b>Clear delivered jobs older than a year</b>
        </div>
        <button type="button" className="btn btn-danger btn-sm" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="setting">
        <div className="t">
          <b>Regenerate OMI webhook secret</b>
          <span>Every device must be reconnected</span>
        </div>
        <button type="button" className="btn btn-danger btn-sm" onClick={onRegenOmi}>
          Regenerate
        </button>
      </div>
    </div>
  );
}
