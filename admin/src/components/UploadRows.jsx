export function UploadRows({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="uploads" aria-live="polite">
      {rows.map((row) => (
        <div key={row.key} className={`upload-row ${row.state}`}>
          <b>{row.name}</b>
          <span>{row.state === 'failed' ? row.message : row.state === 'done' ? 'Done ✓' : `${row.pct}%`}</span>
          <div className="bar">
            <i style={{ width: `${row.state === 'failed' ? 100 : row.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
