import { workerBaseUrl } from '../../utils/boardUrl.js';

const COLUMNS = [
  { name: 'Quote', color: '#8A93A1', n: 2 },
  { name: 'Approved', color: '#0AA3C7', n: 1 },
  { name: 'Artwork', color: '#7A5AF8', n: 2 },
  { name: 'Printing', color: '#D9247B', n: 3 },
  { name: 'QC', color: '#E8B90C', n: 1 },
  { name: 'Ready', color: '#1F9D55', n: 1 },
];

function boardLink(key) {
  const base = workerBaseUrl();
  return `${base}/?key=${key || ''}`;
}

function maskedKey(key = '') {
  if (key.length <= 6) return key;
  return `${key.slice(0, 4)}…`;
}

export function BoardSection({ form, setField }) {
  const url = boardLink(form.board_key);
  const shown = `${workerBaseUrl()}/?key=${maskedKey(form.board_key)}`;

  return (
    <div className="panel" id="board">
      <div className="panel-head">
        <h3>Job board</h3>
        <p>The fullscreen screen in the shop</p>
      </div>
      <div className={`board-prev ${form.board_theme === 'light' ? 'light' : ''} ${form.board_card_size === 'large' ? 'large' : ''}`.trim()}>
        {COLUMNS.map((col) => (
          <div key={col.name} style={{ '--c': col.color }}>
            {col.name}
            {Array.from({ length: col.n }).map((_, index) => (
              <i key={index}></i>
            ))}
          </div>
        ))}
      </div>
      <div className="setting">
        <div className="t">
          <b>Theme</b>
          <span>Dark is easier to read from across the room</span>
        </div>
        <label className="field sm">
          <select value={form.board_theme} onChange={(event) => setField('board_theme', event.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Card size</b>
        </div>
        <label className="field sm">
          <select value={form.board_card_size} onChange={(event) => setField('board_card_size', event.target.value)}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Show customer name</b>
        </div>
        <span className={`toggle ${form.board_show_customer ? 'on' : ''}`} onClick={() => setField('board_show_customer', !form.board_show_customer)}></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Show due date</b>
        </div>
        <span className={`toggle ${form.board_show_due ? 'on' : ''}`} onClick={() => setField('board_show_due', !form.board_show_due)}></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Flash overdue jobs</b>
        </div>
        <span className={`toggle ${form.board_overdue_highlight ? 'on' : ''}`} onClick={() => setField('board_overdue_highlight', !form.board_overdue_highlight)}></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Refresh interval</b>
          <span>How often the TV board polls if the socket drops</span>
        </div>
        <label className="field sm">
          <select
            value={String(form.board_refresh_seconds)}
            onChange={(event) => setField('board_refresh_seconds', Number(event.target.value))}
          >
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Hide delivered after</b>
          <span>Keeps the Ready column tidy</span>
        </div>
        <label className="field sm">
          <select
            value={String(form.board_hide_delivered_after)}
            onChange={(event) => setField('board_hide_delivered_after', Number(event.target.value))}
          >
            <option value="2">2 hours</option>
            <option value="24">1 day</option>
            <option value="0">Never</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Board link</b>
          <span>Open this on the shop TV — no login needed</span>
        </div>
        <label className="field">
          <input value={shown} readOnly />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(url)}>
            Copy
          </button>
        </label>
      </div>
    </div>
  );
}
