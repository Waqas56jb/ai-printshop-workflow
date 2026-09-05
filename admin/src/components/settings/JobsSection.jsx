import { useState } from 'react';

function ListDialog({ open, title, items, onClose, onSave }) {
  const [list, setList] = useState(items);
  const [value, setValue] = useState('');
  if (!open) return null;

  return (
    <div className="ss-modal">
      <div className="scrim" onClick={onClose}></div>
      <div className="box">
        <div className="mh">{title}</div>
        <div className="mb">
          <div className="chips">
            {list.map((item) => (
              <span key={item} className="chip-item">
                {item}
                <button type="button" onClick={() => setList((current) => current.filter((entry) => entry !== item))}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <label className="field">
            <input
              value={value}
              placeholder="Add type"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const next = value.trim();
                  if (next && !list.includes(next)) setList((current) => [...current, next]);
                  setValue('');
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const next = value.trim();
                if (next && !list.includes(next)) setList((current) => [...current, next]);
                setValue('');
              }}
            >
              Add
            </button>
          </label>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(list)}>
            Save list
          </button>
        </div>
      </div>
    </div>
  );
}

export function JobsSection({ form, setField }) {
  const [listKey, setListKey] = useState(null);
  const next = `${form.job_number_prefix || 'J-'}${form.job_number_next || ''}`;

  return (
    <div className="panel" id="jobs">
      <div className="panel-head">
        <h3>Jobs</h3>
      </div>
      <div className="setting">
        <div className="t">
          <b>Job number format</b>
          <span>Next job will be {next}</span>
        </div>
        <label className="field sm">
          <input value={form.job_number_prefix} onChange={(event) => setField('job_number_prefix', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Default due in</b>
        </div>
        <label className="field sm">
          <select value={String(form.default_due_days)} onChange={(event) => setField('default_due_days', Number(event.target.value))}>
            <option value="3">3 days</option>
            <option value="5">5 days</option>
            <option value="7">7 days</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Default priority</b>
        </div>
        <label className="field sm">
          <select value={form.default_priority} onChange={(event) => setField('default_priority', event.target.value)}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Product types</b>
          <span>{(form.product_types || []).join(', ') || 'None'}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setListKey('product_types')}>
          Edit list
        </button>
      </div>
      <div className="setting">
        <div className="t">
          <b>Print types</b>
          <span>{(form.print_types || []).join(', ') || 'None'}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setListKey('print_types')}>
          Edit list
        </button>
      </div>
      <div className="setting">
        <div className="t">
          <b>Require approved artwork before Printing</b>
          <span>Blocks the move (manual and voice) until one file is approved</span>
        </div>
        <span
          className={`toggle ${form.require_artwork_before_printing ? 'on' : ''}`}
          onClick={() => setField('require_artwork_before_printing', !form.require_artwork_before_printing)}
        ></span>
      </div>
      <ListDialog
        key={listKey || 'list'}
        open={Boolean(listKey)}
        title={listKey === 'print_types' ? 'Print types' : 'Product types'}
        items={form[listKey] || []}
        onClose={() => setListKey(null)}
        onSave={(items) => {
          setField(listKey, items);
          setListKey(null);
        }}
      />
    </div>
  );
}
