import { X } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

export function BulkBar({ count, stages = [], users = [], onApply, onDelete, onClose }) {
  if (count < 1) return null;

  return (
    <div className="bulk">
      <span>{count} selected</span>
      <label className="field">
        <select id="bulk-stage" defaultValue="">
          <option value="">Move to stage…</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <select id="bulk-assign" defaultValue="">
          <option value="">Assign to…</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="ghost"
        className="btn-sm"
        onClick={() => {
          const stage = document.getElementById('bulk-stage')?.value || '';
          const assigned = document.getElementById('bulk-assign')?.value || '';
          onApply({ stage_id: stage || null, assigned_to: assigned || null });
        }}
      >
        Apply
      </Button>
      {onDelete ? (
        <Button
          variant="ghost"
          className="btn-sm"
          onClick={() => {
            if (window.confirm(`Delete ${count} job${count === 1 ? '' : 's'}?`)) onDelete();
          }}
        >
          Delete
        </Button>
      ) : null}
      <button type="button" className="x" onClick={onClose} aria-label="Clear selection">
        <X />
      </button>
    </div>
  );
}
