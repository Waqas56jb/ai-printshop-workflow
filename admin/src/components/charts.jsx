import { useRef, useState } from 'react';

// Small HTML charts for the dashboard. One axis, thin rounded bars from a single
// baseline, labels in text colours (never the bar colour), hover/focus details.
// Series colours: validated pair (blue = new, orange = finished).
const SERIES = { created: '#2a78d6', completed: '#eb6834' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDay(day) {
  const date = new Date(`${day}T00:00:00`);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function niceMax(value) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const k of [1, 2, 2.5, 5, 10]) {
    if (k * step >= value) return k * step;
  }
  return value;
}

// Shared tooltip: follows the pointer inside the chart box, or sits on the focused mark.
function useTip(boxRef) {
  const [tip, setTip] = useState(null);
  function place(event, content) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    let x;
    let y;
    if (event?.clientX != null && event.type !== 'focus') {
      x = event.clientX - box.left;
      y = event.clientY - box.top;
    } else {
      const mark = event.currentTarget.getBoundingClientRect();
      x = mark.left + mark.width / 2 - box.left;
      y = mark.top - box.top;
    }
    setTip({ x, y, content, flip: x > box.width - 170 });
  }
  const node = tip ? (
    <div
      className={`viz-tip${tip.flip ? ' flip' : ''}`}
      style={{ left: tip.x, top: tip.y }}
      role="status"
    >
      {tip.content}
    </div>
  ) : null;
  return { place, hide: () => setTip(null), node };
}

function TipRow({ color, value, label }) {
  return (
    <div className="viz-tip-row">
      <i style={{ background: color }} />
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}

// Horizontal bars: one hue for magnitude; an optional small swatch beside the label
// (e.g. the stage's own colour, the same as the TV column).
export function HBars({ rows, unit = 'jobs', color = SERIES.created, empty = 'Nothing yet' }) {
  const box = useRef(null);
  const { place, hide, node } = useTip(box);
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="hint">{empty}</p>;
  return (
    <div className="hbars" ref={box} onPointerLeave={hide}>
      {rows.map((row) => {
        const content = (
          <>
            <div className="viz-tip-title">{row.label}</div>
            <TipRow color={color} value={row.value} label={row.value === 1 ? unit.replace(/s$/, '') : unit} />
            {row.extra ? <div className="viz-tip-note">{row.extra}</div> : null}
          </>
        );
        return (
          <div
            key={row.key || row.label}
            className="hbar"
            tabIndex={0}
            onPointerMove={(event) => place(event, content)}
            onFocus={(event) => place(event, content)}
            onBlur={hide}
            aria-label={`${row.label}: ${row.value} ${unit}`}
          >
            <span className="hbar-label">
              {row.swatch ? <i style={{ background: row.swatch }} /> : null}
              {row.label}
            </span>
            <span className="hbar-track">
              {row.value ? (
                <span className="hbar-fill" style={{ width: `${(row.value / max) * 100}%`, background: color }} />
              ) : null}
              <span className="hbar-value num">{row.value}</span>
            </span>
          </div>
        );
      })}
      {node}
    </div>
  );
}

// New vs finished jobs per week: grouped columns, one tooltip per week with both values.
export function WeekColumns({ weeks }) {
  const box = useRef(null);
  const { place, hide, node } = useTip(box);
  const [asTable, setAsTable] = useState(false);
  const top = niceMax(Math.max(1, ...weeks.flatMap((week) => [week.created, week.completed])));
  const ticks = [top, top / 2, 0];

  return (
    <div>
      <div className="viz-bar-top">
        <div className="viz-legend">
          <span>
            <i style={{ background: SERIES.created }} />
            New jobs
          </span>
          <span>
            <i style={{ background: SERIES.completed }} />
            Finished
          </span>
        </div>
        <button type="button" className="link-btn" onClick={() => setAsTable((value) => !value)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <table className="viz-table">
          <thead>
            <tr>
              <th>Week of</th>
              <th>New</th>
              <th>Finished</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.week_start}>
                <td>{shortDay(week.week_start)}</td>
                <td className="num">{week.created}</td>
                <td className="num">{week.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="cols-chart" ref={box} onPointerLeave={hide}>
          <div className="cols-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <div key={tick} className="cols-tick">
                <span className="num">{Number.isInteger(tick) ? tick : tick.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="cols-plot">
            {weeks.map((week, index) => {
              const content = (
                <>
                  <div className="viz-tip-title">Week of {shortDay(week.week_start)}</div>
                  <TipRow color={SERIES.created} value={week.created} label="new" />
                  <TipRow color={SERIES.completed} value={week.completed} label="finished" />
                </>
              );
              return (
                <div
                  key={week.week_start}
                  className="cols-group"
                  tabIndex={0}
                  onPointerMove={(event) => place(event, content)}
                  onFocus={(event) => place(event, content)}
                  onBlur={hide}
                  aria-label={`Week of ${shortDay(week.week_start)}: ${week.created} new, ${week.completed} finished`}
                >
                  <div className="cols-bars">
                    <span style={{ height: `${(week.created / top) * 100}%`, background: SERIES.created }} />
                    <span style={{ height: `${(week.completed / top) * 100}%`, background: SERIES.completed }} />
                  </div>
                  <div className={`cols-x${index % 2 ? ' odd' : ''}`}>{shortDay(week.week_start)}</div>
                </div>
              );
            })}
          </div>
          {node}
        </div>
      )}
    </div>
  );
}
