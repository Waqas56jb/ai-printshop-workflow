import { useEffect, useState } from 'react';
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ss-modal">
      <div className="scrim" onClick={onClose}></div>
      <form className="box" onSubmit={handleSubmit}>
        <div className="mh">{editing ? 'Edit person' : 'Add person'}</div>
        <div className="mb">
          {error ? <div className="login-error">{error}</div> : null}
          <div className="f">
            <label>Full name</label>
            <label className="field">
              <input
                value={form.full_name}
                onChange={(event) => setField('full_name', event.target.value)}
                placeholder="e.g. Nida Khan"
                required
              />
            </label>
          </div>
          <div className="f">
            <label>Role</label>
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
            <label>Job title (optional)</label>
            <label className="field">
              <input
                value={form.job_title}
                onChange={(event) => setField('job_title', event.target.value)}
                placeholder="e.g. Designer"
              />
            </label>
          </div>
          {!worker ? (
            <div className="f">
              <label>Email</label>
              <label className="field">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setField('email', event.target.value)}
                  placeholder="name@printshop.com"
                  required
                />
              </label>
            </div>
          ) : null}
          {!worker && !editing ? (
            <div className="f">
              <label>Temporary password</label>
              <label className="field">
                <input
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
              </label>
              <span className="hint">Share this with them; they can change it after signing in.</span>
            </div>
          ) : null}
          <div className="f">
            <label>OMI device</label>
            <label className="field">
              <select value={form.omi_uid} onChange={(event) => setField('omi_uid', event.target.value)}>
                <option value="">Assign later</option>
                {options.map((device) => (
                  <option key={device.omi_uid} value={device.omi_uid}>
                    {shortUid(device.omi_uid)} {device.user ? '' : '(unassigned)'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add person'}
          </button>
        </div>
      </form>
    </div>
  );
}
