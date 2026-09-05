import { useCallback, useEffect, useRef, useState } from 'react';
import { createRealtimeSession, runRealtimeTool } from '../services/realtime.service.js';
import { useVoiceAgentStore } from '../store/voiceAgentStore.js';

const IDLE_MS = 3 * 60 * 1000;
const TIPS = [
  "What's due today?",
  "New job for Café Nine, 120 menu cards, due Monday",
  "Where is Sarah's job?",
  'Move J-1025 to QC',
];

function sendEvent(channel, payload) {
  if (channel?.readyState === 'open') {
    channel.send(JSON.stringify(payload));
  }
}

function toolDetail(name, result) {
  const job = result?.result;
  if (name === 'move_stage' && job?.job_number) {
    return `${job.job_number}${job.stage ? ` → ${job.stage}` : ''}`;
  }
  if (name === 'resolve_job' || name === 'get_job_status') {
    const n = result?.result?.count;
    if (n > 1) return `${n} matches — which job?`;
    if (n === 0) return 'No matching job';
  }
  if (result?.error) return result.error;
  if (job?.job_number) return job.job_number;
  return '';
}

export function useRealtimeAgent() {
  const store = useVoiceAgentStore();
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const idleRef = useRef(null);
  const [micStream, setMicStream] = useState(null);

  const bumpIdle = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      stop();
    }, IDLE_MS);
  }, []);

  const stop = useCallback(() => {
    clearTimeout(idleRef.current);
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    pcRef.current = null;
    dcRef.current = null;
    streamRef.current = null;
    setMicStream(null);
    store.setStatus('off');
    store.setOpen(false);
    store.setMuted(false);
  }, [store]);

  const sendText = useCallback((text) => {
    if (!text) return;
    bumpIdle();
    store.addMessage({ role: 'user', text, at: Date.now() });
    sendEvent(dcRef.current, {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendEvent(dcRef.current, { type: 'response.create' });
  }, [bumpIdle, store]);

  const pickJob = useCallback(
    (job) => {
      sendText(`use job ${job.job_number}`);
    },
    [sendText]
  );

  async function handleFunctionCall(event) {
    const name = event.name;
    let args = {};
    try {
      args = event.arguments ? JSON.parse(event.arguments) : {};
    } catch {
      args = {};
    }
    const toolId = event.call_id || `${Date.now()}`;
    store.addTool({ id: toolId, name, status: 'wait', detail: 'Working…' });
    store.setStatus('thinking');
    const result = await runRealtimeTool(name, args);
    const candidates = result?.result?.candidates || [];
    const needs = result?.needs_confirmation || candidates.length > 1;
    store.updateTool(toolId, {
      ok: result?.ok,
      status: needs ? 'needs' : result?.ok ? 'done' : 'failed',
      detail: toolDetail(name, result),
      error: result?.error,
      candidates,
      result,
    });
    sendEvent(dcRef.current, {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: event.call_id,
        output: JSON.stringify(result),
      },
    });
    sendEvent(dcRef.current, { type: 'response.create' });
    if (name === 'end_session' || result?.result?.ended) {
      stop();
    }
  }

  function onRealtimeEvent(raw) {
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    bumpIdle();
    const type = event.type || '';
    if (type === 'conversation.item.input_audio_transcription.completed') {
      const text = event.transcript || event.item?.content?.[0]?.transcript || '';
      if (text) store.addMessage({ role: 'user', text, at: Date.now() });
      store.setStatus('thinking');
      return;
    }
    if (type === 'response.audio_transcript.delta' || type === 'response.output_audio_transcript.delta') {
      store.appendAssistantDelta(event.delta || '');
      store.setStatus('speaking');
      return;
    }
    if (type === 'response.audio_transcript.done' || type === 'response.output_audio_transcript.done') {
      store.finalizeAssistant(event.transcript || '');
      return;
    }
    if (type === 'response.function_call_arguments.done') {
      handleFunctionCall(event);
      return;
    }
    if (type === 'input_audio_buffer.speech_started') {
      store.setStatus('listening');
      return;
    }
    if (type === 'response.audio.delta' || type === 'response.output_audio.delta') {
      store.setStatus('speaking');
      return;
    }
    if (type === 'error' || type === 'response.failed') {
      store.setError(event.error?.message || event.message || 'Realtime error');
    }
  }

  const start = useCallback(async () => {
    store.setError('');
    store.resetLog();
    store.setOpen(true);
    store.setStatus('listening');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStream(stream);
      const session = await createRealtimeSession();
      modelRef.current = session.model;
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
      };
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (event) => onRealtimeEvent(event.data);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.client_secret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      if (!sdpResponse.ok) {
        throw new Error('Could not connect the realtime session');
      }
      const answer = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      bumpIdle();
    } catch (error) {
      const denied = error.name === 'NotAllowedError' || /permission|denied/i.test(error.message || '');
      store.setError(
        denied
          ? 'Microphone blocked — allow it in the browser address bar and try again.'
          : error.response?.data?.message || error.message || 'Could not start voice assistant'
      );
      store.setStatus('off');
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
  }, [bumpIdle, store]);

  const toggleMute = useCallback(() => {
    const next = !store.muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    store.setMuted(next);
  }, [store]);

  useEffect(() => () => stop(), [stop]);

  return {
    ...store,
    stream: micStream,
    tips: TIPS,
    start,
    stop,
    toggle: () => (store.status === 'off' ? start() : stop()),
    toggleMute,
    sendText,
    pickJob,
  };
}
