import { useCallback, useEffect, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddStageRow } from '../../components/stages/AddStageRow.jsx';
import { BoardPreview } from '../../components/stages/BoardPreview.jsx';
import { StageList } from '../../components/stages/StageList.jsx';
import { ConfirmDialog } from '../../components/staff/ConfirmDialog.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import {
  createStage,
  deleteStage,
  getBoard,
  listJobs,
  listStages,
  reorderStages,
  updateStage,
} from '../../services/jobs.service.js';

export default function StagesPage() {
  const [stages, setStages] = useState([]);
  const [counts, setCounts] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    const [rows, board, completed] = await Promise.all([
      listStages(),
      getBoard(),
      listJobs({ status: 'completed', page: 1, limit: 1 }),
    ]);
    setStages(rows || []);
    const columns = Array.isArray(board) ? board : board?.stages || [];
    const next = {};
    columns.forEach((column) => {
      next[column.id] = column.jobs?.length || 0;
    });
    const finalStage = (rows || []).find((stage) => stage.is_final);
    if (finalStage) next[finalStage.id] = completed.total || 0;
    setCounts(next);
    setDirty(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((error) => toast.error(error.response?.data?.message || 'Failed to load stages'))
      .finally(() => setLoading(false));
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
      toast.success('Stage order saved');
      setDirty(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save order');
    } finally {
      setSaving(false);
    }
  }

  async function handlePatch(id, payload) {
    const key = `${id}:${Object.keys(payload).join(',')}`;
    setBusyKey(key);
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
      if (payload.name) toast.success('Stage renamed');
      else if (payload.color) toast.success('Color updated');
      else if (payload.aliases) toast.success('Voice aliases updated');
      else if (payload.show_on_board !== undefined) {
        toast.success(payload.show_on_board ? 'Shown on board' : 'Hidden from board');
      } else if (payload.is_default) toast.success('Default stage updated');
      else if (payload.is_final) toast.success('Completion stage updated');
      else toast.success('Stage updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update stage');
    } finally {
      setBusyKey('');
    }
  }

  async function handleDelete() {
    const stage = pendingDelete;
    if (!stage) return;
    setBusyKey(`${stage.id}:delete`);
    try {
      await deleteStage(stage.id);
      setStages((current) => current.filter((item) => item.id !== stage.id));
      setPendingDelete(null);
      toast.success(`“${stage.name}” deleted`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete stage');
      throw error;
    } finally {
      setBusyKey('');
    }
  }

  async function handleAdd(payload) {
    setBusyKey('add');
    try {
      const created = await createStage(payload);
      setStages((current) => [...current, created]);
      toast.success(`“${created.name || payload.name}” added`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not add stage');
      throw error;
    } finally {
      setBusyKey('');
    }
  }

  return (
    <main className="sv-page">
      <div className="intro">
        <div>
          <h2>Workflow stages</h2>
          <p>
            Every job moves left to right through these stages. Drag to reorder. Names here appear on
            the job board and what workers say to OMI.
          </p>
        </div>
        {dirty ? (
          <Button onClick={saveOrder} disabled={saving || Boolean(busyKey)}>
            {saving ? (
              <>
                <Loader2 className="spin" />
                Saving…
              </>
            ) : (
              'Save order'
            )}
          </Button>
        ) : (
          <Button variant="ghost" disabled className="sv-saved">
            Saved
          </Button>
        )}
      </div>

      {loading ? (
        <div className="sv-loading panel">
          <Spinner />
          <span>Loading stages…</span>
        </div>
      ) : (
        <StageList
          stages={stages}
          counts={counts}
          menuId={menuId}
          busyKey={busyKey}
          onMenu={(id) => setMenuId(id)}
          onDragEnd={onDragEnd}
          onPatch={handlePatch}
          onDelete={(stage) => setPendingDelete(stage)}
        >
          <AddStageRow onAdd={handleAdd} busy={busyKey === 'add'} />
        </StageList>
      )}

      {!loading ? <BoardPreview stages={stages} counts={counts} /> : null}

      <div className="warn">
        <AlertTriangle />
        <div>
          A stage with jobs in it can&apos;t be deleted — move its jobs first. Renaming a stage updates
          the board and voice aliases immediately.
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.name || ''}”?`}
        body="This removes the stage from the workflow. Jobs already in other stages are not affected."
        confirmLabel="Delete stage"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
