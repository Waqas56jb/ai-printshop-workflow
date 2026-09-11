import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function ConfirmDialog({ open, title, body, confirmLabel, danger, requireText, onClose, onConfirm }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped('');
      setBusy(false);
    }
  }, [open, title]);

  if (!open) return null;

  const blocked = requireText && typed !== requireText;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setTyped('');
    }
  }

  return createPortal(
    <div className="ss-modal" role="dialog" aria-modal="true">
      <button type="button" className="ss-modal-scrim" aria-label="Close" onClick={onClose} />
      <div className="ss-modal-box">
        <div className="mh">{title}</div>
        <div className="mb">
          {body ? <p className="hint">{body}</p> : null}
          {requireText ? (
            <div className="f">
              <label htmlFor="ss-confirm-text">Type {requireText} to continue</label>
              <input
                id="ss-confirm-text"
                className="ss-input"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoFocus
              />
            </div>
          ) : null}
        </div>
        <div className="mf">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={blocked || busy}
            onClick={handleConfirm}
          >
            {busy ? 'Working…' : confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
