import { useState } from 'react';
import { formatShortDate } from '../../utils/date.js';

function PasswordDialog({ open, onClose, onSave }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  return (
    <div className="ss-modal">
      <button type="button" className="ss-modal-scrim" aria-label="Close" onClick={onClose} />
      <form
        className="ss-modal-box"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave({ current_password: current, new_password: next });
            setCurrent('');
            setNext('');
          } catch (err) {
            setError(err.response?.data?.message || err.message || 'Could not change password');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mh">Change password</div>
        <div className="mb">
          {error ? <div className="login-error">{error}</div> : null}
          <div className="f">
            <label htmlFor="ss-cur-pass">Current password</label>
            <input
              id="ss-cur-pass"
              className="ss-input"
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="f">
            <label htmlFor="ss-new-pass">New password</label>
            <input
              id="ss-new-pass"
              className="ss-input"
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              minLength={8}
              required
            />
          </div>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AccountSection({ form, setField, profile, onChangePassword, onSignOut }) {
  const [pwOpen, setPwOpen] = useState(false);
  const changed = profile?.updated_at ? formatShortDate(profile.updated_at) : null;

  return (
    <div className="panel" id="account">
      <div className="panel-head">
        <h3>My account</h3>
      </div>
      <div className="setting">
        <div className="t">
          <b>Name</b>
        </div>
        <label className="field">
          <input value={form.account_name} onChange={(event) => setField('account_name', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Email</b>
        </div>
        <label className="field">
          <input type="email" value={form.account_email} onChange={(event) => setField('account_email', event.target.value)} />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Password</b>
          <span>{changed ? `Last changed ${changed}` : 'Change your sign-in password'}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPwOpen(true)}>
          Change password
        </button>
      </div>
      <div className="setting">
        <div className="t">
          <b>Sign out everywhere</b>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <PasswordDialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onSave={async (payload) => {
          await onChangePassword(payload);
          setPwOpen(false);
        }}
      />
    </div>
  );
}
