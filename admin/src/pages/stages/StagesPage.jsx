import { useCallback, useEffect, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AddStageRow } from '../../components/stages/AddStageRow.jsx';
import { BoardPreview } from '../../components/stages/BoardPreview.jsx';
import { StageList } from '../../components/stages/StageList.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { createStage, deleteStage, getBoard, listJobs, listStages, reorderStages, updateStage } from '../../services/jobs.service.js';

export default function StagesPage() {
  const [stages, setStages] = useState([]);
  const [counts, setCounts] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuId, setMenuId] = useState(null);

  const load = useCallback(async () => {
    const [rows, board, completed] = await Promise.all([
      listStages(),
      getBoard(),
      listJobs({ status: 'completed', page: 1, limit: 1 }),
    ]);
    setStages(rows || []);
    const next = {};
    (board || []).forEach((column) => {
      next[column.id] = column.jobs?.length || 0;
    });
    const finalStage = (rows || []).find((stage) => stage.is_final);
    if (finalStage) next[finalStage.id] = completed.total || 0;
    setCounts(next);
    setDirty(false);
  }, []);

  useEffect(() => {
    load().catch((error) => toast(error.response?.data?.message || 'Failed to load stages'));
  }, [load]);

  useEffect(() => {
    function onDoc() {
      setMenuId(null);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStages((current) => {
      const oldIndex = current.findIndex((stage) => stage.id === active.id);
      const newIndex = current.findIndex((stage) => stage.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
    setDirty(true);
  }

  async function saveOrder() {
    setSaving(true);
    try {
      await reorderStages(stages.map((stage) => stage.id));
      toast('Stage order saved');
      setDirty(false);
    } catch (error) {
      toast(error.response?.data?.message || 'Could not save order');
    } finally {
      setSaving(false);
    }
  }

  async function handlePatch(id, payload) {
    try {
      const updated = await updateStage(id, payload);
      setStages((current) =>
        current.map((stage) => {
          if (stage.id === id) return { ...stage, ...updated };
          if (payload.is_default) return { ...stage, is_default: false };
          if (payload.is_final) return { ...stage, is_final: false };
          return stage;
        })
      );
      setMenuId(null);
    } catch (error) {
      toast(error.response?.data?.message || 'Could not update stage');
    }
  }

  async function handleDelete(stage) {
    if (!window.confirm(`Delete stage “${stage.name}”?`)) return;
    try {
      await deleteStage(stage.id);
      setStages((current) => current.filter((item) => item.id !== stage.id));
      toast('Stage deleted');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not delete stage');
    }
  }

  async function handleAdd(payload) {
    try {
      const created = await createStage(payload);
      setStages((current) => [...current, created]);
      toast('Stage added');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not add stage');
    }
  }

  return (
    <main className="sv-page">
      <div className="intro">
        <div>
          <h2>Workflow stages</h2>
          <p>Every job moves left to right through these stages. Drag to reorder. The names here are what appear on the job board and what workers say to OMI.</p>
        </div>
        {dirty ? (
          <Button onClick={saveOrder} disabled={saving}>
            {saving ? 'Saving…' : 'Save order'}
          </Button>
        ) : (
          <Button variant="ghost" disabled style={{ opacity: 0.5 }}>
            Saved
          </Button>
        )}
      </div>

      <StageList
        stages={stages}
        counts={counts}
        menuId={menuId}
        onMenu={(id) => setMenuId(id)}
        onDragEnd={onDragEnd}
        onPatch={handlePatch}
        onDelete={handleDelete}
      >
        <AddStageRow onAdd={handleAdd} />
      </StageList>

      <BoardPreview stages={stages} counts={counts} />

      <div className="warn">
        <AlertTriangle />
        <div>A stage with jobs in it can't be deleted — move its jobs first. Renaming a stage updates the board and voice aliases immediately.</div>
      </div>
    </main>
  );
}
