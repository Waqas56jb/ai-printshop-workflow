export function KpiCard({ value, subtitle, bar = 0, barColor, footnote }) {
  return (
    <div className="panel kpi">
      <div className="big num">{value}</div>
      <div className="sub">{subtitle}</div>
      <div className="bar">
        <i style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: barColor }}></i>
      </div>
      {footnote ? (
        <div className="sub" style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>
          {footnote}
        </div>
      ) : null}
    </div>
  );
}
