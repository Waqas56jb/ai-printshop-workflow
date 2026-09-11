import { useEffect, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Loader2, Mic, MoreVertical, Trash2 } from 'lucide-react';
import { STAGE_COLORS } from './AddStageRow.jsx';

function SortableRow({ stage, count, busyKey, onPatch, onDelete, onMenu, menuOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [name, setName] = useState(stage.name);
  useEffect(() => {
    setName(stage.name);
  }, [stage.name]);
  const [colorOpen, setColorOpen] = useState(false);
  const [aliasOpen, setAliasOpen] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');
  const aliases = stage.aliases || [];
  const jobs = count || 0;
  const hasJobs = jobs > 0;
  const rowBusy = busyKey.startsWith(`${stage.id}:`);
  const boardOn = stage.show_on_board !== false;

  function saveName() {
    const next = name.trim();
    if (!next || next === stage.name) {
      setName(stage.name);
      return;
    }
    onPatch(stage.id, { name: next });
  }

  function addAlias() {
    const value = aliasDraft.trim().toLowerCase();
    if (!value || aliases.includes(value)) {
      setAliasOpen(false);
      setAliasDraft('');
      return;
    }
    onPatch(stage.id, { aliases: [...aliases, value] });
    setAliasDraft('');
    setAliasOpen(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`stage-row${isDragging ? ' dragging' : ''}${rowBusy ? ' is-busy' : ''}${menuOpen ? ' is-open' : ''}`}
    >
      <span className="grip" {...attributes} {...listeners} title="Drag to reorder" aria-label="Drag to reorder">
        <GripVertical />
      </span>
      <button
        type="button"
        className="swatch"
        style={{ background: stage.color }}
        aria-label="Change color"
        title="Change color"
        disabled={rowBusy}
        onClick={() => setColorOpen((open) => !open)}
      >
        {colorOpen ? (
          <div className="swatch-pop" onClick={(event) => event.stopPropagation()}>
            {STAGE_COLORS.map((hex) => (
              <i
                key={hex}
                className={`palette-dot${stage.color === hex ? ' on' : ''}`}
                style={{ background: hex }}
                onClick={() => {
                  onPatch(stage.id, { color: hex });
                  setColorOpen(false);
                }}
              />
            ))}
          </div>
        ) : null}
      </button>
      <div className="name">
        <input
          value={name}
          disabled={rowBusy}
          aria-label="Stage name"
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
        <div className="aliases">
          {aliases.map((alias) => (
            <span className="alias" key={alias}>
              {alias === aliases[0] ? <Mic /> : null}
              {alias}
              <button
                type="button"
                className="x"
                aria-label={`Remove alias ${alias}`}
                disabled={rowBusy}
                onClick={() => onPatch(stage.id, { aliases: aliases.filter((item) => item !== alias) })}
              >
                ×
              </button>
            </span>
          ))}
          {aliasOpen ? (
            <span className="alias add">
              <input
                autoFocus
                value={aliasDraft}
                disabled={rowBusy}
                onChange={(event) => setAliasDraft(event.target.value)}
                onBlur={addAlias}
                onKeyDown={(event) => event.key === 'Enter' && addAlias()}
              />
            </span>
          ) : (
            <button type="button" className="alias add" disabled={rowBusy} onClick={() => setAliasOpen(true)}>
              + alias
            </button>
          )}
        </div>
      </div>
      <div className="role">
        {stage.is_default ? <span className="tag on">Default</span> : null}
        {stage.is_final ? <span className="tag final">Completes</span> : null}
        {!stage.is_default && !stage.is_final ? <span className="tag muted">—</span> : null}
      </div>
      <span className="count num">
        {jobs} {stage.is_final ? 'total' : jobs === 1 ? 'job' : 'jobs'}
      </span>
      <button
        type="button"
        className={`board-toggle${boardOn ? ' on' : ''}`}
        disabled={rowBusy}
        title={boardOn ? 'Hide from board' : 'Show on board'}
        aria-pressed={boardOn}
        onClick={() => onPatch(stage.id, { show_on_board: !boardOn })}
      >
        {boardOn ? <Eye /> : <EyeOff />}
        <span>{boardOn ? 'On board' : 'Hidden'}</span>
      </button>
      <div className="row-ops">
        {rowBusy ? <Loader2 className="spin row-spinner" aria-label="Working" /> : null}
        <button
          type="button"
          className="icon-btn"
          title="More actions"
          aria-expanded={menuOpen}
          disabled={rowBusy}
          onClick={(event) => {
            event.stopPropagation();
            onMenu(stage.id);
          }}
        >
          <MoreVertical />
          <span className="op-label">More</span>
        </button>
        <button
          type="button"
          className="icon-btn danger"
          title={hasJobs ? 'Move this stage’s jobs first' : 'Delete stage'}
          disabled={hasJobs || rowBusy}
          onClick={() => !hasJobs && onDelete(stage)}
        >
          <Trash2 />
          <span className="op-label">Delete</span>
        </button>
      </div>
    </div>
  );
}

export function StageList({ stages, counts, menuId, busyKey = '', onMenu, onDragEnd, onPatch, onDelete, children }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <div className="panel stage-panel">
      <div className="stage-head">
        <span className="sr-only">Drag</span>
        <span className="sr-only">Color</span>
        <span>Stage</span>
        <span>Role</span>
        <span>Jobs</span>
        <span>Board</span>
        <span>Actions</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
          <div className="stage-list">
            {stages.length === 0 ? (
              <div className="stage-empty">No stages yet — add one below.</div>
            ) : (
              stages.map((stage) => (
                <div key={stage.id} className="stage-wrap">
                  <SortableRow
                    stage={stage}
                    count={counts[stage.id] || 0}
                    busyKey={busyKey}
                    menuOpen={menuId === stage.id}
                    onPatch={onPatch}
                    onDelete={onDelete}
                    onMenu={onMenu}
                  />
                  {menuId === stage.id ? (
                    <div className="more-menu" onClick={(event) => event.stopPropagation()}>
                      <button type="button" disabled={busyKey.startsWith(`${stage.id}:`)} onClick={() => onPatch(stage.id, { is_default: true })}>
                        Set as default for new jobs
                      </button>
                      <button type="button" disabled={busyKey.startsWith(`${stage.id}:`)} onClick={() => onPatch(stage.id, { is_final: true })}>
                        Set as completes the job
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
      {children}
    </div>
  );
}
