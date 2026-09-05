import { formatClockDate, formatClockTime } from '../utils/date.js';

export function BoardHeader({ shop, summary, live, now }) {
  return (
    <header className="head">
      <div className="brand">
        <div className="brand-mark">
          {shop?.logo_url ? <img src={shop.logo_url} alt="" /> : 'P'}
        </div>
        <b>{shop?.name || 'Print Shop'}</b>
      </div>
      <div className="summary">
        <div className="sum">
          <b className="num">{summary?.in_progress ?? 0}</b>
          <span>in progress</span>
        </div>
        <div className="sum">
          <b className="num">{summary?.due_today ?? 0}</b>
          <span>due today</span>
        </div>
        <div className={`sum${summary?.overdue ? ' warn' : ''}`}>
          <b className="num">{summary?.overdue ?? 0}</b>
          <span>overdue</span>
        </div>
        <div className="sum">
          <b className="num">{summary?.delivered_this_week ?? 0}</b>
          <span>delivered this week</span>
        </div>
      </div>
      <div className={`live${live ? '' : ' off'}`}>
        <i></i>Live
      </div>
      <div className="clock">
        <div className="t num">{formatClockTime(now)}</div>
        <div className="d">{formatClockDate(now)}</div>
      </div>
    </header>
  );
}
