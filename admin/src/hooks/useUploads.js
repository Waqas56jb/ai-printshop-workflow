import { useCallback, useState } from 'react';
import { errorWords } from '../utils/plain.js';

// Upload any number of files, two at a time, with a progress row per file.
// `send(file, onPct)` does the actual upload; returns how many made it.
export function useUploads() {
  const [rows, setRows] = useState([]);

  const run = useCallback(async (fileList, send) => {
    const files = Array.from(fileList || []);
    if (!files.length) return 0;
    const batch = files.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      pct: 0,
      state: 'busy',
    }));
    setRows((current) => [...current, ...batch]);
    const update = (key, patch) =>
      setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

    let done = 0;
    const queue = files.map((file, index) => ({ file, row: batch[index] }));
    async function worker() {
      while (queue.length) {
        const { file, row } = queue.shift();
        try {
          await send(file, (pct) => update(row.key, { pct }));
          update(row.key, { pct: 100, state: 'done' });
          done += 1;
        } catch (err) {
          update(row.key, { state: 'failed', message: errorWords(err, 'Did not upload') });
        }
      }
    }
    await Promise.all([worker(), worker()]);
    // Finished rows fade out; failed ones stay so the reason can be read.
    setTimeout(() => {
      setRows((current) => current.filter((row) => !batch.some((b) => b.key === row.key) || row.state === 'failed'));
    }, 2500);
    return done;
  }, []);

  const clearFailed = useCallback(() => setRows((current) => current.filter((row) => row.state !== 'failed')), []);

  return { rows, run, busy: rows.some((row) => row.state === 'busy'), clearFailed };
}
