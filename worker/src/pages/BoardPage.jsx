import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardHeader } from '../components/BoardHeader.jsx';
import { NoKeyScreen } from '../components/NoKeyScreen.jsx';
import { OfflineBanner } from '../components/OfflineBanner.jsx';
import { StageColumn } from '../components/StageColumn.jsx';
import { VoiceTickerBar } from '../components/VoiceTickerBar.jsx';
import { SpotlightOverlay } from '../components/SpotlightOverlay.jsx';
import { JobDetailsOverlay } from '../components/JobDetailsOverlay.jsx';
import { ArtworkOverlay } from '../components/ArtworkOverlay.jsx';
import { ConfirmOverlay } from '../components/ConfirmOverlay.jsx';
import { useBoard } from '../hooks/useBoard.js';
import { useBoardVoice } from '../hooks/useBoardVoice.js';
import { useClock } from '../hooks/useClock.js';
import { flattenBoardJobs, filterBoardJobs } from '../utils/boardJobs.js';

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

  const [artworkIndex, setArtworkIndex] = useState(0);
  const [zoom, setZoom] = useState(false);

  const flatJobs = useMemo(() => flattenBoardJobs(data?.stages), [data?.stages]);
  const focusedJobIdRef = useRef(null);
  const voiceEmitRef = useRef(() => {});

  const onNext = useCallback(() => {
    const list = flatJobs;
    if (!list.length) return;
    const idx = list.findIndex((job) => job.id === focusedJobIdRef.current);
    const target = list[(idx + 1 + list.length) % list.length] || list[0];
    voiceEmitRef.current('board:focus_request', { job_id: target.id });
  }, [flatJobs]);

  const onPrev = useCallback(() => {
    const list = flatJobs;
    if (!list.length) return;
    const idx = list.findIndex((job) => job.id === focusedJobIdRef.current);
    const prevIdx = idx <= 0 ? list.length - 1 : idx - 1;
    const target = list[prevIdx];
    if (target) voiceEmitRef.current('board:focus_request', { job_id: target.id });
  }, [flatJobs]);

  const onZoom = useCallback(() => setZoom((current) => !current), []);

  const voice = useBoardVoice(
    boardReady,
    { key: boardKey, label, preview },
    { onNext, onPrev, onZoom, emitRef: voiceEmitRef }
  );

  useEffect(() => {
    focusedJobIdRef.current = voice.focusedJob?.job_id || null;
  }, [voice.focusedJob]);

  useEffect(() => {
    if (voice.view === 'artwork' && voice.artwork) {
      setArtworkIndex(voice.artwork.index || 0);
      setZoom(false);
    }
  }, [voice.view, voice.artwork]);

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
    function onDblClick() {
      requestFullscreen();
    }
    window.addEventListener('dblclick', onDblClick);
    return () => window.removeEventListener('dblclick', onDblClick);
  }, [preview, boardReady]);

  useEffect(() => {
    if (preview || !boardReady) return undefined;
    const id = setTimeout(() => window.location.reload(), msUntilHour(4));
    return () => clearTimeout(id);
  }, [preview, boardReady]);

  // Voice/board keyboard shortcuts: Esc backs out one level, B backs an artwork
  // view out to the spotlight, and ← → mean different things depending on what's
  // on screen — job cards on the plain board, stage moves inside the spotlight,
  // artwork files inside the artwork viewer.
  useEffect(() => {
    if (preview || !boardReady) return undefined;
    function onKey(event) {
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        requestFullscreen();
        return;
      }
      if (event.key === 'Escape') {
        if (voice.view === 'board') return;
        voice.backToBoard();
        return;
      }
      if ((event.key === 'b' || event.key === 'B') && voice.view === 'artwork') {
        voice.setView('spotlight');
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const forward = event.key === 'ArrowRight';
        if (voice.view === 'artwork') {
          const total = voice.focusedJob?.artworks?.length || 0;
          if (total > 1) {
            setArtworkIndex((idx) => (forward ? (idx + 1) % total : (idx - 1 + total) % total));
          }
        } else if (voice.view === 'spotlight') {
          voice.moveStage(forward ? 'next' : 'prev');
        } else if (voice.view === 'board') {
          (forward ? onNext : onPrev)();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, boardReady, voice.view, voice.focusedJob, voice.backToBoard, voice.setView, voice.moveStage, onNext, onPrev]);

  if (invalid) {
    return <NoKeyScreen />;
  }

  if (!data && !offline) {
    return null;
  }

  const settings = data?.settings || {};
  const stages = filterBoardJobs(data?.stages || [], voice.filter);

  return (
    <div className="board">
      {offline ? <OfflineBanner /> : null}
      <BoardHeader
        shop={data?.shop}
        summary={data?.summary}
        stages={stages}
        live={!offline}
        now={now}
        speaking={voice.speaking}
      />
      <main className={`cols${voice.view !== 'board' ? ' dimmed' : ''}`}>
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            settings={settings}
            prevJobs={prevJobs}
            focusedJobId={voice.focusedJob?.job_id || null}
            keepVisible={voice.view !== 'board' && stage.id === voice.focusedJob?.stage_id}
          />
        ))}
      </main>
      <VoiceTickerBar ticker={voice.ticker} updatedAt={updatedAt} />

      {voice.view === 'spotlight' && voice.focusedJob ? (
        <SpotlightOverlay
          job={voice.focusedJob}
          onShowArtwork={() => voice.setView('artwork')}
          onShowDetails={() => voice.setView('details')}
          onNextStage={() => voice.moveStage('next')}
          onPrevStage={() => voice.moveStage('prev')}
          onBack={voice.backToBoard}
        />
      ) : null}

      {voice.view === 'details' && voice.focusedJob ? (
        <JobDetailsOverlay
          job={voice.focusedJob}
          onBack={() => voice.setView('spotlight')}
          onArtwork={(index) => {
            setArtworkIndex(index);
            voice.setView('artwork');
          }}
        />
      ) : null}

      {voice.view === 'artwork' && voice.focusedJob ? (
        <ArtworkOverlay
          job={voice.focusedJob}
          index={artworkIndex}
          zoom={zoom}
          onIndexChange={setArtworkIndex}
          onZoomToggle={() => setZoom((current) => !current)}
          onBackToJob={() => voice.setView('spotlight')}
          onBackToBoard={voice.backToBoard}
        />
      ) : null}

      {voice.view === 'confirm' && voice.confirmState ? (
        <ConfirmOverlay data={voice.confirmState} onSelect={voice.confirmReply} onCancel={voice.cancelConfirm} />
      ) : null}
    </div>
  );
}
