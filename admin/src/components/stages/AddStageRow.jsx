import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

export const STAGE_COLORS = ['#8A93A1', '#0AA3C7', '#7A5AF8', '#D9247B', '#E8B90C', '#1F9D55', '#E8622C', '#161A1F'];

export function AddStageRow({ onAdd, busy = false }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#D9247B');

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    try {
      await onAdd({ name: trimmed, color });
      setName('');
    } catch {
      /* toast handled by parent */
    }
  }

  return (
    <div className="add-row">
      <label className="field add-name">
        <span className="sr-only">New stage name</span>
        <input
          placeholder="New stage name, e.g. Packing"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
      </label>
      <div className="palette" role="listbox" aria-label="Stage color">
        {STAGE_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`palette-swatch${color === hex ? ' on' : ''}`}
            style={{ background: hex }}
            aria-label={`Color ${hex}`}
            aria-pressed={color === hex}
            disabled={busy}
            onClick={() => setColor(hex)}
          />
        ))}
      </div>
      <Button className="btn-sm add-stage-btn" onClick={submit} disabled={busy || !name.trim()}>
        {busy ? (
          <>
            <Loader2 className="spin" />
            Adding…
          </>
        ) : (
          'Add stage'
        )}
      </Button>
    </div>
  );
}
