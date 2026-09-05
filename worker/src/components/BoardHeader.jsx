import { formatClockDate, formatClockTime } from '../utils/date.js';
import { BoardMetrics } from './BoardMetrics.jsx';

export function BoardHeader({ shop, summary, stages, live, now }) {
  return (
    <header className="head">
      <div className="head-top">
        <div className="brand">
          <div className="brand-mark">
            {shop?.logo_url ? <img src={shop.logo_url} alt="" /> : 'P'}
          </div>
          <div className="brand-copy">
            <b>{shop?.name || 'Print Shop'}</b>
            <span>Shop floor</span>
          </div>
        </div>
        <div className={`live${live ? '' : ' off'}`}>
          <i></i>
          {live ? 'Live' : 'Offline'}
        </div>
        <div className="clock">
          <div className="t num">{formatClockTime(now)}</div>
          <div className="d">{formatClockDate(now)}</div>
        </div>
      </div>
      <BoardMetrics stages={stages} summary={summary} />
    </header>
  );
}
