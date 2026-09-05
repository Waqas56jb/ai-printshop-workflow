export function NotificationsSection({ form, setField }) {
  return (
    <div className="panel" id="notify">
      <div className="panel-head">
        <h3>Notifications</h3>
      </div>
      <div className="setting">
        <div className="t">
          <b>Email</b>
        </div>
        <label className="field">
          <input value={form.notify_email} onChange={(event) => setField('notify_email', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Overdue jobs</b>
          <span>Once a day at opening time</span>
        </div>
        <span className={`toggle ${form.notify_overdue_email ? 'on' : ''}`} onClick={() => setField('notify_overdue_email', !form.notify_overdue_email)}></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Voice command needs confirmation</b>
          <span>Immediately</span>
        </div>
        <span className={`toggle ${form.notify_pending_voice ? 'on' : ''}`} onClick={() => setField('notify_pending_voice', !form.notify_pending_voice)}></span>
      </div>
      <div className="setting">
        <div className="t">
          <b>Daily summary</b>
          <span>Jobs completed, created, and due tomorrow</span>
        </div>
        <span className={`toggle ${form.notify_daily_summary ? 'on' : ''}`} onClick={() => setField('notify_daily_summary', !form.notify_daily_summary)}></span>
      </div>
    </div>
  );
}
