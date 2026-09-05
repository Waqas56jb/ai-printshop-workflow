import { useEffect, useState } from 'react';

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

  return (
    <div className="ss-modal">
      <div className="scrim" onClick={onClose}></div>
      <div className="box">
        <div className="mh">{title}</div>
        <div className="mb">
          {body ? <p className="hint">{body}</p> : null}
          {requireText ? (
            <div className="f">
              <label>Type {requireText} to continue</label>
              <label className="field">
                <input value={typed} onChange={(event) => setTyped(event.target.value)} />
              </label>
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
    </div>
  );
}
