import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyRow } from '../components/MoreDialog.jsx';
import { useShopLinks } from '../hooks/useShopLinks.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { useVoiceStatus } from '../hooks/useVoiceStatus.js';
import { listVoiceHistory, sendVoiceCommand } from '../services/dashboard.service.js';
import { errorWords, whenWords } from '../utils/plain.js';

const PAGE = 50;
const FILTERS = [
  { key: '', label: 'Everything' },
  { key: 'executed', label: 'Done' },
  { key: 'failed', label: 'Not understood / failed' },
  { key: 'pending_confirmation', label: 'Waiting' },
];
const STATUS_WORDS = {
  executed: 'Done',
  failed: 'Did not work',
  pending_confirmation: 'Waiting for yes/no',
  rejected: 'Cancelled',
};

// What the TV said back (stored with each command), or the plain reason it failed.
function didWords(row) {
  const reply = row.intent?.reply;
  if (reply) return reply;
  if (row.status === 'failed') {
    if (/not understood/i.test(row.error || '')) return 'Did not understand';
    return row.error || 'Did not work';
  }
  return '';
}

function whoWords(row) {
  if (row.user_name) return row.user_name;
  if (row.omi_uid) return 'OMI';
  return 'Typed in the panel';
}

function heardWords(at, now) {
  if (!at) return 'Nothing heard from the OMI yet';
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return 'Heard just now';
  if (mins < 60) return `Heard ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Heard ${hours} hr ago`;
  return `Heard ${Math.floor(hours / 24)} days ago`;
}

export default function VoicePage() {
  const { on, heardAt, now, status } = useVoiceStatus(15_000);
  const { boardLink, omiLink } = useShopLinks();
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(new Set());
  const [typed, setTyped] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const seen = useRef(new Set());
  const timer = useRef(null);

  const load = useCallback(
    async (nextPage = 1) => {
      try {
        const result = await listVoiceHistory({ page: nextPage, limit: PAGE, status: filter || undefined });
        const items = result.items || [];
        // Highlight rows that arrived since the last look.
        if (nextPage === 1 && seen.current.size) {
          setFresh(new Set(items.filter((row) => !seen.current.has(row.id)).map((row) => row.id)));
        }
        items.forEach((row) => seen.current.add(row.id));
        setRows((current) => (nextPage === 1 ? items : [...current, ...items]));
        setTotal(result.total || 0);
        setPage(nextPage);
        setError('');
      } catch (err) {
        setError(errorWords(err, 'Could not load what the OMI heard.'));
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    setLoading(true);
    load(1);
  }, [load]);

  // New commands show up the moment they happen.
  const onLive = useCallback(
    (_payload, event) => {
      if (event !== 'voice:command') return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => load(1), 200);
    },
    [load]
  );
  useSocket(onLive);

  async function send(event) {
    event.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setSending(true);
    setReply('');
    try {
      const result = await sendVoiceCommand(text);
      setReply(result?.data?.message || result?.message || 'Done.');
      setTyped('');
    } catch (err) {
      setReply(errorWords(err, 'That did not work.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title="Voice" />
      <main className="content">
        <div className="voice-top">
          <section className="panel">
            <div className={`status-big${on ? ' on' : ''}`}>
              <i />
              {on ? 'Voice is on' : 'Voice is quiet'}
            </div>
            <p className="hint" style={{ marginTop: 4 }}>
              {heardWords(heardAt, now)}
            </p>
            <div className="stat-row">
              <span>
                <b className="num">{status?.today_count ?? '—'}</b>
                commands today
              </span>
              <span>
                <b className="num">{status ? `${status.understood_percent}%` : '—'}</b>
                understood
              </span>
              <span>
                <b className="num">{status?.devices?.length ?? '—'}</b>
                OMI device{status?.devices?.length === 1 ? '' : 's'}
              </span>
            </div>
          </section>

          <section className="panel">
            <h2>Try a command</h2>
            <p className="hint" style={{ marginBottom: 10 }}>
              Type what you would say to the OMI — the TV reacts the same way.
            </p>
            <form className="try-row" onSubmit={send}>
              <input
                className="input"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="show sarah's job"
                aria-label="Command"
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !typed.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
            {reply ? <p className="try-reply">TV says: {reply}</p> : null}
          </section>

          <section className="panel">
            <h2>Links</h2>
            <CopyRow label="TV board link" value={boardLink} />
            <CopyRow label="OMI webhook link" value={omiLink} />
          </section>
        </div>

        <h2 style={{ fontSize: 22, marginBottom: 12 }}>What the OMI heard</h2>
        <div className="filters" role="tablist">
          {FILTERS.map((item) => (
            <button
              key={item.key || 'all'}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              className={filter === item.key ? 'on' : ''}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? <div className="banner-error">{error}</div> : null}
        {loading && !rows.length ? (
          <div className="loading">Loading…</div>
        ) : rows.length ? (
          <>
            <ul className="heard-list">
              {rows.map((row) => {
                const did = didWords(row);
                return (
                  <li key={row.id} className={`heard ${row.status}${fresh.has(row.id) ? ' heard-new' : ''}`}>
                    <div className="meta">
                      <span>{whenWords(row.created_at)}</span>
                      <span>· {whoWords(row)}</span>
                      <span className={`chip ${row.status}`}>{STATUS_WORDS[row.status] || row.status}</span>
                      {row.job_number ? <span className="chip">{row.job_number}</span> : null}
                    </div>
                    <div className="said">“{row.transcript}”</div>
                    {did ? <div className="did">→ {did}</div> : null}
                  </li>
                );
              })}
            </ul>
            {rows.length < total ? (
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <button type="button" className="btn" onClick={() => load(page + 1)}>
                  Show older
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="placeholder">
            <h2>Nothing yet</h2>
            <p>When someone speaks to the OMI, it shows up here straight away.</p>
          </div>
        )}
      </main>
    </>
  );
}
