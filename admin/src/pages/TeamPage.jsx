import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Icon } from '../components/Icon.jsx';
import { CopyRow } from '../components/MoreDialog.jsx';
import { Modal } from '../components/Modal.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useAuth } from '../hooks/useAuth.js';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  makePassword,
  setPassword,
  updateAccount,
} from '../services/users.service.js';
import { errorWords, whenWords } from '../utils/plain.js';

const ROLE_WORDS = { admin: 'Admin', staff: 'Sub-admin' };

function plain(err, fallback) {
  const message = errorWords(err, fallback);
  if (/validation/i.test(message)) return 'Please check the email, and use a password of at least 8 characters.';
  return message;
}

function PasswordField({ value, onChange }) {
  const [show, setShow] = useState(true);
  return (
    <label className="field">
      <span>
        Password <small>(at least 8 characters)</small>
      </span>
      <div className="pw-row">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
        />
        <button type="button" className="btn" onClick={() => onChange(makePassword())}>
          <Icon name="key" />
          Make one
        </button>
        <button type="button" className="btn" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );
}

function RoleField({ value, onChange, disabled }) {
  return (
    <fieldset className="field role-pick" disabled={disabled}>
      <span>What can they do?</span>
      <label className={value === 'staff' ? 'on' : ''}>
        <input type="radio" name="role" checked={value === 'staff'} onChange={() => onChange('staff')} />
        <b>Sub-admin</b>
        <small>Jobs, Files, Customers and Voice. Can’t add, change or remove people.</small>
      </label>
      <label className={value === 'admin' ? 'on' : ''}>
        <input type="radio" name="role" checked={value === 'admin'} onChange={() => onChange('admin')} />
        <b>Admin</b>
        <small>Everything, including this Team page and editing stages.</small>
      </label>
    </fieldset>
  );
}

// Shown once after creating someone or setting a password, to hand over.
function SignInDetails({ person, password, onClose }) {
  return (
    <Modal title="Give them these sign-in details" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 14, fontSize: 17 }}>
        Write these down or copy them now — for safety, the password can’t be shown again later. You can always set a
        new one.
      </p>
      <CopyRow label="Email" value={person.email} />
      <CopyRow label="Password" value={password} />
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function PersonForm({ initial, isSelf, onSave, onCancel, withPassword }) {
  const [name, setName] = useState(initial?.full_name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [role, setRole] = useState(initial?.role || 'staff');
  const [password, setPw] = useState(withPassword ? makePassword() : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) return setError('Please type their name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please type a correct email address.');
    if (withPassword && password.trim().length < 8) return setError('The password needs at least 8 characters.');
    setBusy(true);
    setError('');
    try {
      await onSave({ full_name: name.trim(), email: email.trim().toLowerCase(), role, password: password.trim() });
    } catch (err) {
      setError(plain(err, 'Could not save. Please try again.'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ali Khan" />
        </label>
        <label className="field">
          <span>Email (used to sign in)</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ali@example.com" />
        </label>
      </div>
      {withPassword ? <PasswordField value={password} onChange={setPw} /> : null}
      <RoleField value={role} onChange={setRole} disabled={isSelf} />
      {isSelf ? <p className="hint">You can’t change your own role — ask another admin.</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : withPassword ? 'Add person' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function NewPassword({ person, onDone, onCancel }) {
  const [password, setPw] = useState(makePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (password.trim().length < 8) return setError('The password needs at least 8 characters.');
    setBusy(true);
    try {
      await setPassword(person.id, password.trim());
      onDone(password.trim());
    } catch (err) {
      setError(plain(err, 'Could not change the password.'));
      setBusy(false);
    }
  }
  return (
    <Modal title={`New password for ${person.full_name}`} onClose={onCancel}>
      <form onSubmit={submit}>
        <p className="hint" style={{ marginBottom: 12, fontSize: 17 }}>
          Their old password stops working straight away.
        </p>
        <PasswordField value={password} onChange={setPw} />
        {error ? <p className="error-text">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeletePerson({ person, onDone, onCancel }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Remove ${person.full_name}?`} onClose={onCancel}>
      <p style={{ fontSize: 18, marginBottom: 14 }}>
        They will not be able to sign in any more. Jobs and files they made stay in the shop.
      </p>
      <label className="field">
        <span>Type DELETE to confirm</span>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
      </label>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Keep
        </button>
        <button
          type="button"
          className="btn btn-danger-solid"
          disabled={busy || typed.trim().toUpperCase() !== 'DELETE'}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteAccount(person.id);
              onDone();
            } catch (err) {
              toast(plain(err, 'Could not remove them.'));
              setBusy(false);
            }
          }}
        >
          {busy ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Modal>
  );
}

function PersonRow({ person, selfId, onAction }) {
  const isSelf = person.id === selfId;
  return (
    <li className="person">
      <span className="avatar">{(person.full_name || '?').trim().charAt(0).toUpperCase()}</span>
      <span className="person-main">
        <b>
          {person.full_name}
          {isSelf ? <span className="chip" style={{ marginLeft: 8 }}>You</span> : null}
        </b>
        <span className="cust-sub">{person.email}</span>
        <span className="cust-meta">
          {ROLE_WORDS[person.role]} ·{' '}
          {person.last_active_at ? `last seen ${whenWords(person.last_active_at)}` : 'not signed in yet'}
        </span>
      </span>
      <span className="person-tools">
        <button type="button" className="btn" onClick={() => onAction('edit', person)}>
          Edit
        </button>
        <button type="button" className="btn" onClick={() => onAction('password', person)}>
          Password
        </button>
        {isSelf ? null : (
          <button type="button" className="btn btn-danger" onClick={() => onAction('delete', person)}>
            Remove
          </button>
        )}
      </span>
    </li>
  );
}

export default function TeamPage() {
  const { profile } = useAuth();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try {
      setPeople(await listAccounts());
      setError('');
    } catch (err) {
      setError(plain(err, 'Could not load the team.'));
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') load();
  }, [load, profile?.role]);

  // Sub-admins can't manage people (the server refuses them too).
  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />;

  const close = () => setDialog(null);
  const admins = (people || []).filter((p) => p.role === 'admin');
  const subs = (people || []).filter((p) => p.role === 'staff');

  return (
    <>
      <PageHeader title="Team">
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
          + Add person
        </button>
      </PageHeader>
      <main className="content">
        <div className="section-note">
          <b>Admins</b> can do everything, including adding, changing and removing people. <b>Sub-admins</b> can use
          Jobs, Files, Customers and Voice, but can’t add, change or remove anyone. Passwords are never stored where
          they can be read — set a new one any time with <b>Password</b>, and you’ll see it once to give to them.
        </div>
        {error ? <div className="banner-error">{error}</div> : null}
        {!people ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            <h2 className="list-head">Admins ({admins.length})</h2>
            <ul className="people">
              {admins.map((person) => (
                <PersonRow key={person.id} person={person} selfId={profile?.id} onAction={(kind, p) => setDialog({ kind, person: p })} />
              ))}
            </ul>
            <h2 className="list-head">Sub-admins ({subs.length})</h2>
            {subs.length ? (
              <ul className="people">
                {subs.map((person) => (
                  <PersonRow key={person.id} person={person} selfId={profile?.id} onAction={(kind, p) => setDialog({ kind, person: p })} />
                ))}
              </ul>
            ) : (
              <p className="hint">No sub-admins yet. Press “+ Add person”.</p>
            )}
          </>
        )}
      </main>

      {dialog?.kind === 'add' ? (
        <Modal title="Add a person" onClose={close}>
          <PersonForm
            withPassword
            onCancel={close}
            onSave={async (values) => {
              const person = await createAccount(values);
              toast(`${values.full_name} can now sign in`);
              setDialog({ kind: 'details', person: { ...person, email: values.email }, password: values.password });
              load();
            }}
          />
        </Modal>
      ) : null}
      {dialog?.kind === 'edit' ? (
        <Modal title={`Edit ${dialog.person.full_name}`} onClose={close}>
          <PersonForm
            initial={dialog.person}
            isSelf={dialog.person.id === profile?.id}
            onCancel={close}
            onSave={async (values) => {
              const payload = { full_name: values.full_name, email: values.email };
              if (dialog.person.id !== profile?.id) payload.role = values.role;
              await updateAccount(dialog.person.id, payload);
              toast('Saved');
              close();
              load();
            }}
          />
        </Modal>
      ) : null}
      {dialog?.kind === 'password' ? (
        <NewPassword
          person={dialog.person}
          onCancel={close}
          onDone={(password) => setDialog({ kind: 'details', person: dialog.person, password })}
        />
      ) : null}
      {dialog?.kind === 'details' ? <SignInDetails person={dialog.person} password={dialog.password} onClose={close} /> : null}
      {dialog?.kind === 'delete' ? (
        <DeletePerson
          person={dialog.person}
          onCancel={close}
          onDone={() => {
            toast(`${dialog.person.full_name} was removed`);
            close();
            load();
          }}
        />
      ) : null}
    </>
  );
}
