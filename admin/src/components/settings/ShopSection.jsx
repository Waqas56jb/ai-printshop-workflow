import { initials } from '../../utils/format.js';

export function ShopSection({ form, setField, onUpload }) {
  const letter = initials(form.business_name).slice(0, 1) || 'P';

  return (
    <div className="panel" id="shop">
      <div className="panel-head">
        <h3>Shop</h3>
      </div>
      <div className="setting">
        <div className="logo">
          {form.business_logo_url ? <img src={form.business_logo_url} alt="" /> : letter}
        </div>
        <div className="t">
          <b>Logo</b>
          <span>Shown on the sidebar and the TV board</span>
        </div>
        <label className="btn btn-ghost btn-sm">
          Upload
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Shop name</b>
        </div>
        <label className="field">
          <input value={form.business_name} onChange={(event) => setField('business_name', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Phone</b>
        </div>
        <label className="field">
          <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Address</b>
          <span>Printed on job tickets</span>
        </div>
        <label className="field">
          <input value={form.address} onChange={(event) => setField('address', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Currency</b>
        </div>
        <label className="field sm">
          <select value={form.currency} onChange={(event) => setField('currency', event.target.value)}>
            <option>PKR</option>
            <option>USD</option>
            <option>GBP</option>
            <option>AED</option>
          </select>
        </label>
      </div>
      <div className="setting" style={{ alignItems: 'flex-start' }}>
        <div className="t">
          <b>Working hours</b>
          <span>Used for "due today" and overdue timing</span>
        </div>
      </div>
      <div className="hours">
        <span className="d">Mon–Fri</span>
        <label className="field">
          <input value={form.hours_mon_fri_open} onChange={(event) => setField('hours_mon_fri_open', event.target.value)} />
        </label>
        <label className="field">
          <input value={form.hours_mon_fri_close} onChange={(event) => setField('hours_mon_fri_close', event.target.value)} />
        </label>
        <span className="d">Saturday</span>
        <label className="field">
          <input value={form.hours_sat_open} onChange={(event) => setField('hours_sat_open', event.target.value)} />
        </label>
        <label className="field">
          <input value={form.hours_sat_close} onChange={(event) => setField('hours_sat_close', event.target.value)} />
        </label>
        <span className="d">Sunday</span>
        <span className="closed">Closed</span>
      </div>
    </div>
  );
}
