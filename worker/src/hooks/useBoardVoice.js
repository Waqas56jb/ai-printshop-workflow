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

  const socketRef = useRef(null);
  const audioRef = useRef(null);
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
        audio.play().catch(() => {
          finish();
          speakFallback(text, () => {});
        });
        return;
      } catch {
        finish();
      }
    }
    speakFallback(text, finish);
  }, []);

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
      setConnected(true);
      setLastError('');
      socket.emit('join', 'board');
    });
    socket.on('disconnect', (reason) => {
      setConnected(false);
      setLastError(`disconnected: ${reason}`);
    });
    socket.on('connect_error', (error) => {
      setConnected(false);
      setLastError(error?.message || 'connect_error');
    });

    socket.on('board:focus', (payload) => {
      setFocusedJob(payload);
      setView((current) => (current === 'artwork' || current === 'details' ? current : 'spotlight'));
    });
    socket.on('board:details', () => setView('details'));
    socket.on('board:artwork', (payload) => {
      setArtwork(payload);
      setView('artwork');
    });
    socket.on('board:navigate', (payload = {}) => {
      switch (payload.action) {
        case 'back':
          backToBoard();
          break;
        case 'filter':
          setFilter(payload.filter || 'all');
          break;
        case 'next':
          onNextRef.current?.();
          break;
        case 'prev':
          onPrevRef.current?.();
          break;
        case 'zoom':
          onZoomRef.current?.();
          break;
        default:
          break;
      }
    });
    socket.on('board:confirm', (payload) => {
      setConfirmState(payload);
      setView('confirm');
    });
    socket.on('board:speak', (payload = {}) => {
      playAudio(payload.audio_base64, payload.mime, payload.text);
    });
    socket.on('board:ticker', (payload) => setTicker(payload));

    return () => {
      socket.disconnect();
      socketRef.current = null;
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
    backToBoard,
    confirmReply,
    cancelConfirm,
    moveStage,
  };
}
