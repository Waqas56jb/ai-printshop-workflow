import { useState } from 'react';
import { toast } from 'sonner';
import { createStage, deleteStage, reorderStages, updateStage } from '../../services/jobs.service.js';
import { errorWords } from '../../utils/plain.js';
import { Modal } from '../Modal.jsx';

const COLORS = ['#64748b', '#0ea5e9', '#8b5cf6', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#D9247B', '#ef4444'];

function StageRow({ stage, index, count, activeJobs, busy, run, onMove }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(stage.name);
  const [sure, setSure] = useState(false);
  const [blocked, setBlocked] = useState('');

  async function saveName() {
    const next = name.trim();
    setRenaming(false);
    if (!next || next === stage.name) {
      setName(stage.name);
      return;
    }
    const ok = await run(() => updateStage(stage.id, { name: next }), `Renamed to ${next}`);
    if (!ok) setName(stage.name);
  }

  async function remove() {
    if (activeJobs > 0) {
      setBlocked(`Move the ${activeJobs} job${activeJobs === 1 ? '' : 's'} out of ${stage.name} first`);
      return;
    }
    if (!sure) {
      setSure(true);
      return;
    }
    await run(() => deleteStage(stage.id), `${stage.name} removed`);
  }

  return (
    <li className="stage-row">
      <span className="stage-dot" style={{ background: stage.color }} />
      <div className="stage-name">
        {renaming ? (
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setName(stage.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button type="button" className="stage-name-btn" onClick={() => {
              setName(stage.name);
              setRenaming(true);
            }}
            title="Tap to rename">
            {stage.name}
          </button>
        )}
        <div className="stage-sub">
          {index === 0 ? 'New jobs start here · ' : ''}
          {index === count - 1 ? 'Moving here finishes the job · ' : ''}
          {activeJobs} job{activeJobs === 1 ? '' : 's'}
        </div>
        {blocked ? <p className="error-text">{blocked}</p> : null}
      </div>
      <div className="stage-tools">
        <button type="button" className="btn icon-btn" onClick={() => onMove(index, -1)} disabled={busy || index === 0} aria-label={`Move ${stage.name} up`}>
          ↑
        </button>
        <button type="button" className="btn icon-btn" onClick={() => onMove(index, 1)} disabled={busy || index === count - 1} aria-label={`Move ${stage.name} down`}>
          ↓
        </button>
        <button
          type="button"
          className={`btn ${sure ? 'btn-danger-solid' : 'btn-danger'}`}
          onClick={remove}
          onBlur={() => setSure(false)}
          disabled={busy}
        >
          {sure ? 'Sure? Remove' : 'Remove'}
        </button>
      </div>
    </li>
  );
}

// Every change saves right away; the Jobs columns, the TV board and voice all
// read the same stages, so they update together.
export function StagesEditor({ stages, jobs, onChanged, onClose }) {
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [color, setColor] = useState(COLORS[1]);

  async function run(work, message) {
    setBusy(true);
    try {
      await work();
      if (message) toast(message);
      await onChanged();
      return true;
    } catch (err) {
      toast(errorWords(err, 'That did not save. Please try again.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function move(index, direction) {
    const ids = stages.map((stage) => stage.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderStages(ids));
  }

  async function add(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const ok = await run(() => createStage({ name, color }), `${name} added`);
    if (ok) setNewName('');
  }

  const activeIn = (stageId) => jobs.filter((job) => job.status === 'active' && job.stage_id === stageId).length;

  return (
    <Modal full title="Edit stages" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 16, fontSize: 18 }}>
        Tap a name to change it. Changes show on the TV straight away.
      </p>
      <ul className="stage-list">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            count={stages.length}
            activeJobs={activeIn(stage.id)}
            busy={busy}
            run={run}
            onMove={move}
          />
        ))}
      </ul>
      <form className="stage-add" onSubmit={add}>
        <h3>Add a stage</h3>
        <input
          className="input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Stage name, like Packing"
          aria-label="New stage name"
        />
        <div className="color-dots" role="radiogroup" aria-label="Stage color">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={color === item}
              aria-label={`Color ${item}`}
              className={`color-dot${color === item ? ' on' : ''}`}
              style={{ background: item }}
              onClick={() => setColor(item)}
            />
          ))}
        </div>
        <button type="submit" className="btn btn-primary btn-big" disabled={busy || !newName.trim()}>
          Add stage
        </button>
        <p className="hint">New stages go just before the last one.</p>
      </form>
    </Modal>
  );
}
