import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from '../../hooks/useSocket.js';
import { getBoardKey, getBoardStats } from '../../services/board.service.js';
import { workerBoardUrl } from '../../utils/boardUrl.js';

export default function BoardPage() {
  const [key, setKey] = useState('');
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [board, stats] = await Promise.all([getBoardKey(), getBoardStats().catch(() => null)]);
      setKey(board?.key || '');
      setLive(Boolean(stats?.live));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load board key');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSocket = useCallback((payload, event) => {
    if (event === 'board:screens') {
      const list = Array.isArray(payload) ? payload : [];
      setLive(list.some((row) => row.online));
    }
  }, []);
  useSocket(onSocket);

  const src = key ? workerBoardUrl({ key, preview: true, label: 'Staff panel' }) : '';

  return (
    <main className="staff-board">
      <div className="board-bar">
        <span className={`live-pill ${live ? '' : 'off'}`.trim()}>
          <i></i>
          {live ? 'Live' : 'No screens'}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!src}
          onClick={() => window.open(src, '_blank', 'noopener')}
        >
          Open on this screen
        </button>
      </div>
      {error ? <p className="login-error">{error}</p> : null}
      {src ? (
        <iframe title="Job board preview" src={src} />
      ) : (
        <div className="empty">Waiting for the shop board key…</div>
      )}
    </main>
  );
}
