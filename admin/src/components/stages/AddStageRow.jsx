import { useState } from 'react';
import { Button } from '../ui/Button.jsx';

export const STAGE_COLORS = ['#8A93A1', '#0AA3C7', '#7A5AF8', '#D9247B', '#E8B90C', '#1F9D55', '#E8622C', '#161A1F'];

export function AddStageRow({ onAdd }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#D9247B');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAdd({ name: trimmed, color });
      setName('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="add-row">
      <label className="field">
        <input
          placeholder="New stage name, e.g. Packing"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
      </label>
      <div className="palette">
        {STAGE_COLORS.map((hex) => (
          <i
            key={hex}
            className={color === hex ? 'on' : ''}
            style={{ background: hex }}
            onClick={() => setColor(hex)}
          />
        ))}
      </div>
      <Button className="btn-sm" onClick={submit} disabled={saving || !name.trim()}>
        Add stage
      </Button>
    </div>
  );
}
