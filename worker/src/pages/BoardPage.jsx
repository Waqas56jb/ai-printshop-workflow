import { useEffect, useRef } from 'react';
import { BoardHeader } from '../components/BoardHeader.jsx';
import { NoKeyScreen } from '../components/NoKeyScreen.jsx';
import { OfflineBanner } from '../components/OfflineBanner.jsx';
import { StageColumn } from '../components/StageColumn.jsx';
import { VoiceTicker } from '../components/VoiceTicker.jsx';
import { useBoard } from '../hooks/useBoard.js';
import { useClock } from '../hooks/useClock.js';

function requestFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.().catch(() => {});
  }
}

function msUntilHour(hour) {
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - Date.now();
}

export function BoardPage({ boardKey, preview = false, label = '' }) {
  const now = useClock();
  const prevJobs = useRef(new Map());
  const { data, offline, invalid, updatedAt } = useBoard(boardKey, { preview, label });
  const boardReady = !invalid && Boolean(data || offline);

  useEffect(() => {
    const theme = data?.settings?.theme || 'dark';
    const size = data?.settings?.card_size || 'normal';
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.size = size;
    document.body.dataset.theme = theme;
    document.body.dataset.size = size;
    if (data?.shop?.name) {
      document.title = `${data.shop.name} · Job board`;
    }
  }, [data]);

  useEffect(() => {
    if (preview || !boardReady) return undefined;
    let lock;
    async function acquire() {
      try {
        if (navigator.wakeLock) {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* unsupported or denied */
      }
    }
    acquire();
    function onVisible() {
      if (document.visibilityState === 'visible') acquire();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [preview, boardReady]);

  useEffect(() => {
    if (preview || !boardReady) return undefined;
    function onKey(event) {
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        requestFullscreen();
      }
    }
    function onDblClick() {
      requestFullscreen();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('dblclick', onDblClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dblclick', onDblClick);
    };
  }, [preview, boardReady]);

  useEffect(() => {
    if (preview || !boardReady) return undefined;
    const id = setTimeout(() => window.location.reload(), msUntilHour(4));
    return () => clearTimeout(id);
  }, [preview, boardReady]);

  if (invalid) {
    return <NoKeyScreen />;
  }

  if (!data && !offline) {
    return null;
  }

  const settings = data?.settings || {};
  const stages = data?.stages || [];

  return (
    <div className="board">
      {offline ? <OfflineBanner /> : null}
      <BoardHeader shop={data?.shop} summary={data?.summary} stages={stages} live={!offline} now={now} />
      <main className="cols">
        {stages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} settings={settings} prevJobs={prevJobs} />
        ))}
      </main>
      <VoiceTicker lastVoice={data?.last_voice} updatedAt={updatedAt} />
    </div>
  );
}
