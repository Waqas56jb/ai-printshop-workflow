import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { createCustomer, updateCustomer } from '../../services/jobs.service.js';

const empty = { name: '', company: '', phone: '', email: '', notes: '' };

export function CustomerModal({ open, customer, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(
      customer
        ? {
            name: customer.name || '',
            company: customer.company || '',
            phone: customer.phone || '',
            email: customer.email || '',
            notes: customer.notes || '',
          }
        : empty
    );
    setError('');
  }, [open, customer]);

  if (!open) return null;

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      };
      const saved = customer ? await updateCustomer(customer.id, payload) : await createCustomer(payload);
      onSaved(saved, customer ? 'updated' : 'created');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cust-modal">
      <div className="scrim" onClick={onClose}></div>
      <div className="box">
        <div className="box-head">
          <h2>{customer ? 'Edit customer' : 'Add customer'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form id="customer-modal-form" onSubmit={handleSubmit}>
          {error ? <div className="login-error">{error}</div> : null}
          <div className="f">
            <label>Name</label>
            <label className="field">
              <input value={form.name} onChange={(event) => setField('name', event.target.value)} required />
            </label>
          </div>
          <div className="f">
            <label>Company</label>
            <label className="field">
              <input
                value={form.company}
                onChange={(event) => setField('company', event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="row">
            <div className="f">
              <label>Phone</label>
              <label className="field">
                <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
              </label>
            </div>
            <div className="f">
              <label>Email</label>
              <label className="field">
                <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
              </label>
            </div>
          </div>
          <div className="f">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} />
          </div>
        </form>
        <div className="box-foot">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-modal-form" disabled={saving}>
            {saving ? 'Saving…' : customer ? 'Save' : 'Add customer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
