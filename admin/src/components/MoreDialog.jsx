import { useEffect, useState } from 'react';
import { getOmiWebhookUrl } from '../services/dashboard.service.js';
import { getSettings } from '../services/settings.service.js';
import { workerBoardUrl } from '../utils/boardUrl.js';
import { Modal } from './Modal.jsx';

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="link-row">
      <b>{label}</b>
      <div className="link-box">
        <code>{value || 'Loading…'}</code>
        <button type="button" className="btn" onClick={copy} disabled={!value}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// The TV board link and the OMI webhook link, ready to copy.
export function MoreDialog({ onClose }) {
  const [boardLink, setBoardLink] = useState('');
  const [omiLink, setOmiLink] = useState('');

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const isPublic = settings.board_public !== false && settings.board_public !== 'false';
        setBoardLink(workerBoardUrl({ key: isPublic ? '' : settings.board_key || '' }));
      })
      .catch(() => setBoardLink(workerBoardUrl()));
    getOmiWebhookUrl()
      .then((result) => setOmiLink(result.url || ''))
      .catch(() => setOmiLink('Could not load the OMI link'));
  }, []);

  return (
    <Modal title="TV and OMI links" onClose={onClose}>
      <CopyRow label="TV board link" value={boardLink} />
      <CopyRow label="OMI webhook link" value={omiLink} />
    </Modal>
  );
}
