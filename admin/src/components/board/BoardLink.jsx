import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { workerBoardUrl } from '../../utils/boardUrl.js';

function maskedUrl(key = '') {
  const url = workerBoardUrl({ key });
  if (key.length <= 6) return url;
  return url.replace(key, `${key.slice(0, 6)}…`);
}

export function BoardLink({ boardKey, boardPublic = true, onPatch }) {
  const url = boardPublic ? workerBoardUrl() : workerBoardUrl({ key: boardKey });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast('Could not copy link');
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Put it on a TV</h3>
      </div>
      {onPatch ? (
        <div className="setting">
          <div className="t">
            <b>Board is public (no link key needed)</b>
            <span>TV can open the plain worker URL. Turn off to require the secret link.</span>
          </div>
          <span
            className={`toggle${boardPublic ? ' on' : ''}`}
            onClick={() => onPatch({ board_public: !boardPublic })}
          ></span>
        </div>
      ) : null}
      <div className="link">
        <div className="url">
          <span>{boardPublic ? url : maskedUrl(boardKey)}</span>
          <button type="button" onClick={copy}>
            Copy
          </button>
        </div>
        <div className="row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.open(url, '_blank')}>
            Open in new tab
          </button>
          <a className="btn btn-ghost btn-sm" href={`mailto:?subject=${encodeURIComponent('Job board link')}&body=${encodeURIComponent(url)}`}>
            Email link
          </a>
        </div>
        <div className="qr">{url ? <QRCodeSVG value={url} size={84} /> : null}</div>
        <div className="hint">Scan on the TV's browser or a phone. Press F on the TV for fullscreen.</div>
      </div>
    </div>
  );
}
