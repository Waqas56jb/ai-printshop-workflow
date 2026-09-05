import { useEffect, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Mic, MoreVertical, Trash2 } from 'lucide-react';
import { STAGE_COLORS } from './AddStageRow.jsx';

function SortableRow({ stage, count, onPatch, onDelete, onMenu }) {
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
    <div ref={setNodeRef} style={style} className={`stage-row ${isDragging ? 'dragging' : ''}`.trim()}>
      <span className="grip" {...attributes} {...listeners}>
        <GripVertical />
      </span>
      <span className="swatch" style={{ background: stage.color }} onClick={() => setColorOpen((open) => !open)}>
        {colorOpen ? (
          <div className="swatch-pop" onClick={(event) => event.stopPropagation()}>
            {STAGE_COLORS.map((hex) => (
              <i
                key={hex}
                className={`palette-dot ${stage.color === hex ? 'on' : ''}`}
                style={{ width: 18, height: 18, borderRadius: '50%', background: hex, display: 'block', cursor: 'pointer', border: stage.color === hex ? '2px solid #161A1F' : '2px solid transparent' }}
                onClick={() => {
                  onPatch(stage.id, { color: hex });
                  setColorOpen(false);
                }}
              />
            ))}
          </div>
        ) : null}
      </span>
      <div className="name">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
        <div className="aliases">
          {aliases.map((alias) => (
            <span className="alias" key={alias}>
              {alias === aliases[0] ? <Mic /> : null}
              {alias}
              <span
                className="x"
                onClick={() => onPatch(stage.id, { aliases: aliases.filter((item) => item !== alias) })}
              >
                ×
              </span>
            </span>
          ))}
          {aliasOpen ? (
            <span className="alias add">
              <input
                autoFocus
                value={aliasDraft}
                onChange={(event) => setAliasDraft(event.target.value)}
                onBlur={addAlias}
                onKeyDown={(event) => event.key === 'Enter' && addAlias()}
              />
            </span>
          ) : (
            <span className="alias add" onClick={() => setAliasOpen(true)}>
              + alias
            </span>
          )}
        </div>
      </div>
      <span>
        {stage.is_default ? <span className="tag on">Default for new jobs</span> : null}
        {stage.is_final ? <span className="tag final">Completes the job</span> : null}
      </span>
      <span className="count num">
        {jobs} {stage.is_final ? 'total' : jobs === 1 ? 'job' : 'jobs'}
      </span>
      <span
        className={`toggle ${stage.show_on_board !== false ? 'on' : ''}`.trim()}
        onClick={() => onPatch(stage.id, { show_on_board: stage.show_on_board === false })}
      />
      <div className="row-ops">
        <button
          type="button"
          className="icon-btn"
          title="More"
          onClick={(event) => {
            event.stopPropagation();
            onMenu(stage.id);
          }}
        >
          <MoreVertical />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={hasJobs ? 'Move this stage’s jobs first' : 'Delete'}
          disabled={hasJobs}
          onClick={() => !hasJobs && onDelete(stage)}
        >
          <Trash2 />
        </button>
      </div>
    </div>
  );
}

export function StageList({ stages, counts, menuId, onMenu, onDragEnd, onPatch, onDelete, children }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <div className="panel">
      <div className="stage-head">
        <span></span>
        <span></span>
        <span>Stage</span>
        <span>Role</span>
        <span>Jobs now</span>
        <span>Board</span>
        <span></span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
          <div className="stage-list">
            {stages.map((stage) => (
              <div key={stage.id} style={{ position: 'relative' }}>
                <SortableRow
                  stage={stage}
                  count={counts[stage.id] || 0}
                  onPatch={onPatch}
                  onDelete={onDelete}
                  onMenu={onMenu}
                />
                {menuId === stage.id ? (
                  <div className="more-menu" style={{ top: 44, right: 52 }} onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => onPatch(stage.id, { is_default: true })}>
                      Set as default for new jobs
                    </button>
                    <button type="button" onClick={() => onPatch(stage.id, { is_final: true })}>
                      Set as completes the job
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {children}
    </div>
  );
}
