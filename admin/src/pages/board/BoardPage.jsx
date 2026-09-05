import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BoardColumns } from '../../components/board/BoardColumns.jsx';
import { BoardDisplaySettings } from '../../components/board/BoardDisplaySettings.jsx';
import { BoardLink } from '../../components/board/BoardLink.jsx';
import { BoardPreview } from '../../components/board/BoardPreview.jsx';
import { BoardStatus } from '../../components/board/BoardStatus.jsx';
import { ConnectedScreens } from '../../components/board/ConnectedScreens.jsx';
import { useSocket } from '../../hooks/useSocket.js';
import { getBoardScreens, getBoardStats } from '../../services/board.service.js';
import { getBoard, listJobs, listStages, updateStage } from '../../services/jobs.service.js';
import { updateSettings } from '../../services/settings.service.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import { formatClockTime } from '../../utils/boardUrl.js';

export default function BoardPage() {
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [stages, setStages] = useState([]);
  const [counts, setCounts] = useState({});
  const [stats, setStats] = useState({ live: false, screens_online: 0, last_fetch_at: null });
  const [screens, setScreens] = useState([]);

  const refreshBoard = useCallback(async () => {
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
  }, []);

  const refreshScreens = useCallback(async () => {
    const [nextStats, nextScreens] = await Promise.all([getBoardStats(), getBoardScreens()]);
    setStats(nextStats || { live: false, screens_online: 0 });
    setScreens(nextScreens || []);
  }, []);

  useEffect(() => {
    loadSettings().catch((error) => toast(error.response?.data?.message || 'Failed to load settings'));
    refreshBoard().catch((error) => toast(error.response?.data?.message || 'Failed to load board'));
    refreshScreens().catch(() => {});
  }, [loadSettings, refreshBoard, refreshScreens]);

  const onSocket = useCallback(
    (payload, event) => {
      if (event === 'board:screens') {
        const list = Array.isArray(payload) ? payload : [];
        setScreens(list);
        const online = list.filter((row) => row.online).length;
        setStats((current) => ({
          ...current,
          live: online > 0,
          screens_online: online,
        }));
        return;
      }
      refreshBoard().catch(() => {});
      refreshScreens().catch(() => {});
    },
    [refreshBoard, refreshScreens]
  );

  useSocket(onSocket);

  async function patchSettings(patch) {
    try {
      const next = await updateSettings(patch);
      setSettings(next);
      toast('Saved');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not save');
    }
  }

  async function toggleColumn(stage) {
    try {
      const updated = await updateStage(stage.id, { show_on_board: stage.show_on_board === false });
      setStages((current) => current.map((row) => (row.id === stage.id ? { ...row, ...updated } : row)));
    } catch (error) {
      toast(error.response?.data?.message || 'Could not update column');
    }
  }

  const reloadKey = useMemo(
    () =>
      [
        settings.board_theme,
        settings.board_card_size,
        settings.board_show_customer,
        settings.board_show_due,
        settings.board_overdue_highlight,
        settings.board_refresh_seconds,
        settings.board_hide_delivered_after,
        stages.map((stage) => `${stage.id}:${stage.show_on_board !== false}`).join(','),
      ].join('|'),
    [settings, stages]
  );

  const status = {
    ...stats,
    updatedLabel: formatClockTime(stats.last_fetch_at),
  };

  return (
    <main className="board-page content">
      <div className="stage">
        <BoardStatus stats={status} settings={settings} onPatch={patchSettings} />
        <BoardPreview boardKey={settings.board_key} reloadKey={reloadKey} />
      </div>
      <aside className="side">
        <BoardLink boardKey={settings.board_key} />
        <BoardDisplaySettings settings={settings} onPatch={patchSettings} />
        <BoardColumns stages={stages} counts={counts} onToggle={toggleColumn} />
        <ConnectedScreens screens={screens} />
      </aside>
    </main>
  );
}
