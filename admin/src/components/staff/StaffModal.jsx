import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { generateTempPassword, shortUid } from '../../utils/password.js';

const empty = {
  full_name: '',
  role: 'staff',
  job_title: '',
  email: '',
  password: '',
  omi_uid: '',
};

export function StaffModal({ open, person, devices, onClose, onSave }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(person);
  const worker = form.role === 'worker';

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    if (person) {
      setForm({
        full_name: person.full_name || '',
        role: person.role || 'staff',
        job_title: person.job_title || '',
        email: person.email || '',
        password: '',
        omi_uid: person.omi_uid || '',
      });
    } else {
      setForm({ ...empty, password: generateTempPassword('') });
    }
  }, [open, person]);

  if (!open) return null;

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const options = (devices || []).filter((device) => !device.user || device.user.id === person?.id);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        job_title: form.job_title.trim() || null,
        email: worker ? undefined : form.email.trim(),
        password: worker || editing ? undefined : form.password,
        omi_uid: form.omi_uid || null,
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save');
      setSaving(false);
    }
  }

  return createPortal(
    <div className="ss-modal" role="dialog" aria-modal="true">
      <button type="button" className="ss-modal-scrim" aria-label="Close" onClick={onClose} />
      <form className="ss-modal-box" onSubmit={handleSubmit}>
        <div className="mh">{editing ? 'Edit person' : 'Add person'}</div>
        <div className="mb">
          {error ? <div className="login-error">{error}</div> : null}
          <div className="f">
            <label htmlFor="ss-full-name">Full name</label>
            <input
              id="ss-full-name"
              className="ss-input"
              value={form.full_name}
              onChange={(event) => setField('full_name', event.target.value)}
              placeholder="e.g. Nida Khan"
              required
              autoFocus
            />
          </div>
          <div className="f">
            <span className="ss-label">Role</span>
            <div className="seg">
              {['admin', 'staff', 'worker'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={form.role === role ? 'on' : ''}
                  onClick={() => setField('role', role)}
                >
                  {role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Worker'}
                </button>
              ))}
            </div>
            <span className="hint">Workers don't sign in — they only use an OMI device.</span>
          </div>
          <div className="f">
            <label htmlFor="ss-job-title">Job title (optional)</label>
            <input
              id="ss-job-title"
              className="ss-input"
              value={form.job_title}
              onChange={(event) => setField('job_title', event.target.value)}
              placeholder="e.g. Designer"
            />
          </div>
          {!worker ? (
            <div className="f">
              <label htmlFor="ss-email">Email</label>
              <input
                id="ss-email"
                className="ss-input"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                placeholder="name@printshop.com"
                required
              />
            </div>
          ) : null}
          {!worker && !editing ? (
            <div className="f">
              <label htmlFor="ss-password">Temporary password</label>
              <div className="ss-pass-row">
                <input
                  id="ss-password"
                  className="ss-input"
                  value={form.password}
                  onChange={(event) => setField('password', event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setField('password', generateTempPassword(form.full_name))}
                >
                  Regenerate
                </button>
              </div>
              <span className="hint">Share this with them; they can change it after signing in.</span>
            </div>
          ) : null}
          <div className="f">
            <label htmlFor="ss-omi">OMI device</label>
            <select
              id="ss-omi"
              className="ss-input ss-select"
              value={form.omi_uid}
              onChange={(event) => setField('omi_uid', event.target.value)}
            >
              <option value="">Assign later</option>
              {options.map((device) => (
                <option key={device.omi_uid} value={device.omi_uid}>
                  {shortUid(device.omi_uid)} {device.user ? '' : '(unassigned)'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add person'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
