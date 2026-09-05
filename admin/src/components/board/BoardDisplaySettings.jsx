export function BoardDisplaySettings({ settings, onPatch }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Display</h3>
        <p>Autosaves</p>
      </div>
      <div className="setting">
        <div className="t">
          <b>Show customer name</b>
        </div>
        <span
          className={`toggle${settings.board_show_customer !== false ? ' on' : ''}`}
          onClick={() => onPatch({ board_show_customer: settings.board_show_customer === false })}
        ></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Show due date</b>
        </div>
        <span
          className={`toggle${settings.board_show_due !== false ? ' on' : ''}`}
          onClick={() => onPatch({ board_show_due: settings.board_show_due === false })}
        ></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Flash overdue jobs</b>
        </div>
        <span
          className={`toggle${settings.board_overdue_highlight !== false ? ' on' : ''}`}
          onClick={() => onPatch({ board_overdue_highlight: settings.board_overdue_highlight === false })}
        ></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Refresh every</b>
        </div>
        <label className="field">
          <select
            value={String(settings.board_refresh_seconds || 30)}
            onChange={(event) => onPatch({ board_refresh_seconds: Number(event.target.value) })}
          >
            <option value="30">30 s</option>
            <option value="15">15 s</option>
            <option value="60">60 s</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Hide delivered after</b>
        </div>
        <label className="field">
          <select
            value={String(settings.board_hide_delivered_after ?? 2)}
            onChange={(event) => onPatch({ board_hide_delivered_after: Number(event.target.value) })}
          >
            <option value="2">2 hours</option>
            <option value="24">1 day</option>
            <option value="0">Never</option>
          </select>
        </label>
      </div>
    </div>
  );
}
