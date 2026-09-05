export function PasswordDialog({ open, title, password, onClose }) {
  if (!open) return null;

  return (
    <div className="ss-modal">
      <div className="scrim" onClick={onClose}></div>
      <div className="box">
        <div className="mh">{title || 'Temporary password'}</div>
        <div className="mb">
          <p className="hint">Share this with them; they can change it after signing in.</p>
          <div className="field">
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
    </div>
  );
}
