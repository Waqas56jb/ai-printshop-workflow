import { createPortal } from 'react-dom';

export function PasswordDialog({ open, title, password, onClose }) {
  if (!open) return null;

  return createPortal(
    <div className="ss-modal" role="dialog" aria-modal="true">
      <button type="button" className="ss-modal-scrim" aria-label="Close" onClick={onClose} />
      <div className="ss-modal-box">
        <div className="mh">{title || 'Temporary password'}</div>
        <div className="mb">
          <p className="hint">Share this with them; they can change it after signing in.</p>
          <div className="ss-pass-row">
            <span className="temp">{password}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard.writeText(password || '')}
            >
              Copy
            </button>
          </div>
        </div>
        <div className="mf">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
