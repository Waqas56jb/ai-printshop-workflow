import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { createCustomer, updateCustomer } from '../../services/jobs.service.js';

const empty = { name: '', company: '', phone: '', email: '', notes: '', network_folder: '' };

function normalizeNetworkPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\+/g, '\\');
}

function formFromCustomer(customer) {
  if (!customer) return empty;
  return {
    name: customer.name || '',
    company: customer.company || '',
    phone: customer.phone || '',
    email: customer.email || '',
    notes: customer.notes || '',
    network_folder: normalizeNetworkPath(customer.network_folder || ''),
  };
}

export function CustomerModal({ open, customer, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(formFromCustomer(customer));
    setSaving(false);
    setError('');
  }, [open, customer?.id, customer?.name, customer?.network_folder, customer?.company, customer?.phone, customer?.email, customer?.notes]);

  if (!open) return null;

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        network_folder: normalizeNetworkPath(form.network_folder) || null,
      };
      if (!payload.name) {
        setError('Name is required');
        setSaving(false);
        return;
      }
      const saved = customer?.id
        ? await updateCustomer(customer.id, payload)
        : await createCustomer(payload);
      setSaving(false);
      onSaved(saved, customer?.id ? 'updated' : 'created');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save customer');
      setSaving(false);
    }
  }

  return createPortal(
    <div className="cust-modal" role="dialog" aria-modal="true">
      <button type="button" className="cust-modal-scrim" aria-label="Close" onClick={onClose} />
      <div className="cust-modal-box">
        <div className="box-head">
          <h2>{customer?.id ? 'Edit customer' : 'Add customer'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {error ? <div className="login-error">{error}</div> : null}
          <div className="f">
            <label htmlFor="cust-name">Name</label>
            <input
              id="cust-name"
              className="cust-input"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="f">
            <label htmlFor="cust-company">Company</label>
            <input
              id="cust-company"
              className="cust-input"
              value={form.company}
              onChange={(event) => setField('company', event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="row">
            <div className="f">
              <label htmlFor="cust-phone">Phone</label>
              <input
                id="cust-phone"
                className="cust-input"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </div>
            <div className="f">
              <label htmlFor="cust-email">Email</label>
              <input
                id="cust-email"
                className="cust-input"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </div>
          </div>
          <div className="f">
            <label htmlFor="cust-folder">Store network folder</label>
            <input
              id="cust-folder"
              className="cust-input"
              value={form.network_folder}
              onChange={(event) => setField('network_folder', event.target.value)}
              placeholder="P:\CUSTOMER FOLDERS\CUSTOMER NAME"
            />
          </div>
          <div className="f">
            <label htmlFor="cust-notes">Notes</label>
            <textarea
              id="cust-notes"
              className="cust-textarea"
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </div>
          <div className="box-foot">
            <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : customer?.id ? 'Save' : 'Add customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
