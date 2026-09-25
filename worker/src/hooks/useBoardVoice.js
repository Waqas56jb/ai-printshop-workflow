import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config.js';

function pickEnglishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find((voice) => /^en/i.test(voice.lang)) || voices[0] || null;
}

function speakFallback(text, onDone) {
  if (!text || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = pickEnglishVoice();
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => onDone?.();
    utter.onerror = () => onDone?.();
    window.speechSynthesis.speak(utter);
  } catch {
    onDone?.();
  }
}

// Dedicated socket for voice-driven board reactions (spotlight, artwork, TTS).
// Joins the same "board" room as the refresh socket so OMI commands hit the TV live.
export function useBoardVoice(
  enabled,
  { key = '', label = '', preview = false } = {},
  { onNext, onPrev, onZoom, emitRef } = {}
) {
  const [view, setView] = useState('board');
  const [focusedJob, setFocusedJob] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [filter, setFilter] = useState('all');
  const [speaking, setSpeaking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState('');
  const [listening, setListening] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const lastSeqRef = useRef(null);
  const connectedRef = useRef(false);
  const listeningTimer = useRef(null);
  const dispatchRef = useRef(() => {});
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  const onZoomRef = useRef(onZoom);
  onNextRef.current = onNext;
  onPrevRef.current = onPrev;
  onZoomRef.current = onZoom;

  const backToBoard = useCallback(() => {
    setView('board');
    setFocusedJob(null);
    setArtwork(null);
  }, []);

  const playAudio = useCallback((base64, mime, text) => {
    setSpeaking(true);
    const finish = () => setSpeaking(false);
    try {
      audioRef.current?.pause?.();
      window.speechSynthesis?.cancel?.();
    } catch {
      /* ignore */
    }
    if (base64) {
      try {
        const audio = new Audio(`data:${mime || 'audio/mpeg'};base64,${base64}`);
        audioRef.current = audio;
        audio.addEventListener('ended', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        audio.play().catch((error) => {
          finish();
          if (error?.name === 'NotAllowedError') setAudioReady(false);
          speakFallback(text, () => {});
        });
        return;
      } catch {
        finish();
      }
    }
    speakFallback(text, finish);
  }, []);

  // Browsers keep a page silent until someone interacts with it once. The first
  // tap/key on the TV unlocks audio for the rest of the session.
  useEffect(() => {
    function unlock() {
      try {
        const silent = new Audio(
          'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
        );
        silent.play().catch(() => {});
        window.speechSynthesis?.speak?.(new SpeechSynthesisUtterance(''));
      } catch {
        /* ignore */
      }
      setAudioReady(true);
    }
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // One dispatcher for both the socket and the HTTP catch-up poll; events carry a
  // server sequence number so whichever channel delivers first wins and the other
  // is ignored.
  dispatchRef.current = (event, payload = {}) => {
    const seq = Number(payload?._seq);
    if (Number.isFinite(seq)) {
      if (lastSeqRef.current != null && seq <= lastSeqRef.current) return;
      lastSeqRef.current = seq;
    }
    switch (event) {
      case 'board:focus':
        setFocusedJob(payload);
        setView((current) => (current === 'artwork' || current === 'details' ? current : 'spotlight'));
        break;
      case 'board:details':
        setView('details');
        break;
      case 'board:artwork':
        setArtwork(payload);
        setView('artwork');
        break;
      case 'board:navigate':
        if (payload.action === 'back') backToBoard();
        else if (payload.action === 'filter') setFilter(payload.filter || 'all');
        else if (payload.action === 'next') onNextRef.current?.();
        else if (payload.action === 'prev') onPrevRef.current?.();
        else if (payload.action === 'zoom') onZoomRef.current?.();
        break;
      case 'board:confirm':
        setConfirmState(payload);
        setView('confirm');
        break;
      case 'board:speak':
        if (!payload.muted) playAudio(payload.audio_base64, payload.mime, payload.text);
        break;
      case 'board:ticker':
        setTicker(payload);
        break;
      case 'board:listening':
        clearTimeout(listeningTimer.current);
        setListening(Boolean(payload.active));
        if (payload.active) listeningTimer.current = setTimeout(() => setListening(false), 12_000);
        break;
      default:
        break;
    }
  };

  // HTTP catch-up: if the TV's WebSocket is blocked or reconnecting, commands still
  // arrive within ~1s. While the socket is healthy this just runs as a slow safety net.
  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let timer;
    async function poll() {
      try {
        const params = new URLSearchParams({ after: String(lastSeqRef.current ?? -1) });
        if (key) params.set('key', key);
        const response = await fetch(`${API_URL}/api/board/events?${params}`, { cache: 'no-store' });
        if (response.ok) {
          const { data } = await response.json();
          if (lastSeqRef.current == null || data?.reset) {
            lastSeqRef.current = data?.seq ?? 0;
          } else {
            (data?.events || []).forEach((row) => dispatchRef.current(row.event, row.payload));
          }
        }
      } catch {
        /* offline — try again next tick */
      }
      if (!stopped) timer = setTimeout(poll, connectedRef.current ? 4000 : 1200);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled) return undefined;

    const auth = { label, preview };
    const query = { label, preview: preview ? '1' : '' };
    if (key) {
      auth.key = key;
      query.key = key;
    }

    const socket = io(API_URL, { auth, query });
    socketRef.current = socket;
    if (emitRef) {
      emitRef.current = (event, payload) => socket.emit(event, payload);
    }

    socket.on('connect', () => {
      connectedRef.current = true;
      setConnected(true);
      setLastError('');
      socket.emit('join', 'board');
    });
    socket.on('disconnect', (reason) => {
      connectedRef.current = false;
      setConnected(false);
      setLastError(`disconnected: ${reason}`);
    });
    socket.on('connect_error', (error) => {
      connectedRef.current = false;
      setConnected(false);
      setLastError(error?.message || 'connect_error');
    });

    [
      'board:focus',
      'board:details',
      'board:artwork',
      'board:navigate',
      'board:confirm',
      'board:speak',
      'board:ticker',
      'board:listening',
    ].forEach((event) => socket.on(event, (payload) => dispatchRef.current(event, payload)));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
      setConnected(false);
      if (emitRef) emitRef.current = () => {};
      window.speechSynthesis?.cancel?.();
      audioRef.current?.pause?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, label, preview, playAudio, backToBoard]);

  const confirmReply = useCallback((jobId) => {
    socketRef.current?.emit('board:confirm_reply', { job_id: jobId });
    setConfirmState(null);
    setView('spotlight');
  }, []);

  const moveStage = useCallback((direction) => {
    socketRef.current?.emit('board:move_stage_request', { direction });
  }, []);

  const cancelConfirm = useCallback(() => {
    setConfirmState(null);
    setView('board');
  }, []);

  return {
    view,
    setView,
    focusedJob,
    artwork,
    confirmState,
    ticker,
    filter,
    speaking,
    connected,
    lastError,
    listening,
    audioReady,
    backToBoard,
    confirmReply,
    cancelConfirm,
    moveStage,
  };
}
