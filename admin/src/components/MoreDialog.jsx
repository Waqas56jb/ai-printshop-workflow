import { useState } from 'react';
import { useShopLinks } from '../hooks/useShopLinks.js';
import { Modal } from './Modal.jsx';

export function CopyRow({ label, value }) {
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

// The same two links, ready to copy, from the sidebar's "Links" button.
export function MoreDialog({ onClose }) {
  const { boardLink, omiLink } = useShopLinks();
  return (
    <Modal title="TV and OMI links" onClose={onClose}>
      <CopyRow label="TV board link" value={boardLink} />
      <CopyRow label="OMI webhook link" value={omiLink} />
    </Modal>
  );
}
