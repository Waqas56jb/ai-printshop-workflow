import { useEffect, useState } from 'react';
import { getOmiSetupStatus } from '../services/dashboard.service.js';

const ON_WINDOW_MS = 10 * 60 * 1000;

function lastHeard(status) {
  const times = [status?.last_command_at, ...(status?.devices || []).map((device) => device.last_heard_at)]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

// "Voice is on" when the OMI was heard in the last 10 minutes.
export function useVoiceStatus(pollMs = 30_000) {
  const [status, setStatus] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const next = await getOmiSetupStatus();
        if (!stopped) setStatus(next);
      } catch {
        /* keep the last known state */
      }
      if (!stopped) setNow(Date.now());
    }
    load();
    const id = setInterval(load, pollMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [pollMs]);

  const heardAt = lastHeard(status);
  return { status, heardAt, on: Boolean(heardAt && now - heardAt < ON_WINDOW_MS) };
}
