export function MetricCard({ label, value, detail, tone }) {
  return (
    <div className="metric">
      <span className="k">{label}</span>
      <span className="v num">{value}</span>
      {detail ? <span className={`d ${tone || ''}`.trim()}>{detail}</span> : null}
    </div>
  );
}
