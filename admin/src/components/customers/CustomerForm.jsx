import { useState } from 'react';
import { errorWords } from '../../utils/plain.js';

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'Sarah Khan', required: true },
  { key: 'phone', label: 'Phone', placeholder: '0300 1234567', type: 'tel' },
  { key: 'email', label: 'Email', placeholder: 'sarah@example.com', type: 'email' },
  { key: 'company', label: 'Business name', placeholder: 'Khan Traders' },
];

// Name is the only must; everything else can be filled in later.
export function CustomerForm({ initial = {}, action = 'Save', onSave, onCancel }) {
  const [values, setValues] = useState(() => ({
    name: initial.name || '',
    phone: initial.phone || '',
    email: initial.email || '',
    company: initial.company || '',
    notes: initial.notes || '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError('Please type the customer’s name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        company: values.company.trim() || null,
        notes: values.notes.trim() || null,
      });
    } catch (err) {
      const message = errorWords(err, 'Could not save. Please try again.');
      setError(/validation/i.test(message) ? 'Please check the email address.' : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        {FIELDS.map((field) => (
          <label key={field.key} className="field">
            <span>
              {field.label}
              {field.required ? null : <small> (optional)</small>}
            </span>
            <input
              className="input"
              type={field.type || 'text'}
              value={values[field.key]}
              onChange={set(field.key)}
              placeholder={field.placeholder}
              autoFocus={field.key === 'name' && !initial.name}
            />
          </label>
        ))}
      </div>
      <label className="field">
        <span>
          Notes <small>(optional)</small>
        </span>
        <textarea className="input textarea" value={values.notes} onChange={set('notes')} rows={3} placeholder="Likes blue ink, pays cash" />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="dialog-actions">
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : action}
        </button>
      </div>
    </form>
  );
}
