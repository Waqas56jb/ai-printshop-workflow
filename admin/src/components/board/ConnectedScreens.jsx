import { formatLastActivity, formatRelative } from '../../utils/date.js';

function ScreenIcon({ device }) {
  if (device === 'mobile') {
    return (
      <svg viewBox="0 0 24 24">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8" />
    </svg>
  );
}

function screenSub(screen) {
  if (screen.online) {
    const who = screen.browser || 'Browser';
    const when = screen.connected_at ? formatRelative(screen.connected_at) : '';
    return when ? `${who} · connected ${when}` : who;
  }
  const seen = screen.last_seen ? formatLastActivity(screen.last_seen) : '';
  return seen ? `Last seen ${seen.toLowerCase() === 'today' ? 'today' : seen.toLowerCase() === 'yesterday' ? 'yesterday' : seen}` : 'Offline';
}

export function ConnectedScreens({ screens }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Screens</h3>
      </div>
      <div className="screens-list">
        {(screens || []).length ? (
          screens.map((screen) => (
            <div className="scr" key={screen.socket_id}>
              <span className="ico">
                <ScreenIcon device={screen.device} />
              </span>
              <div className="t">
                <b>{screen.label || 'Screen'}</b>
                <span>{screenSub(screen)}</span>
              </div>
              <span className={screen.online ? 'on' : 'off'}></span>
            </div>
          ))
        ) : (
          <div className="scr">
            <span className="ico">
              <ScreenIcon device="desktop" />
            </span>
            <div className="t">
              <b>No screens yet</b>
              <span>Open the board link on a TV or phone</span>
            </div>
            <span className="off"></span>
          </div>
        )}
      </div>
    </div>
  );
}
