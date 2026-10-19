import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HBars, WeekColumns } from '../components/charts.jsx';
import { NewJobModal } from '../components/jobs/NewJobModal.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { getOverview } from '../services/dashboard.service.js';
import { errorWords, firstName, whenWords } from '../utils/plain.js';
import { readCache, writeCache } from '../utils/pageCache.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function todayWords() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dueWords(day, today) {
  const diff = Math.round((new Date(`${day}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  if (diff < -1) return { text: `${-diff} days late`, tone: 'late' };
  if (diff === -1) return { text: 'Late since yesterday', tone: 'late' };
  if (diff === 0) return { text: 'Due today', tone: 'today' };
  if (diff === 1) return { text: 'Due tomorrow', tone: '' };
  return { text: `Due in ${diff} days`, tone: '' };
}

function Kpi({ label, value, note, tone = '', to }) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value num">{value ?? '—'}</b>
      {note ? <span className="kpi-note">{note}</span> : null}
    </>
  );
  return to ? (
    <Link to={to} className={`kpi ${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`kpi ${tone}`}>{body}</div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [data, setData] = useState(() => readCache('dashboard', 120_000));
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const next = await getOverview();
      writeCache('dashboard', next);
      setData(next);
      setError('');
    } catch (err) {
      setError(errorWords(err, 'Could not load the dashboard.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Stay current while it is open: any job or voice change refreshes the numbers.
  const onLive = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 500);
  }, [load]);
  useSocket(onLive);

  const k = data?.kpis;

  return (
    <>
      <PageHeader title="Dashboard">
        <span className="hint head-date">{todayWords()}</span>
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + New job
        </button>
      </PageHeader>

      <main className="content">
        <p className="greet">
          {greeting()}
          {profile?.full_name ? `, ${firstName(profile.full_name)}` : ''}.{' '}
          {k ? (
            <span>
              {k.active} job{k.active === 1 ? '' : 's'} in the shop
              {k.late ? `, ${k.late} late` : ''}
              {k.due_today ? `, ${k.due_today} due today` : ''}.
            </span>
          ) : null}
        </p>

        {error ? <div className="banner-error">{error}</div> : null}
        {!data ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            <div className="kpis">
              <Kpi label="Jobs in progress" value={k.active} to="/jobs" />
              <Kpi label="Due today" value={k.due_today} tone={k.due_today ? 'today' : ''} to="/jobs" />
              <Kpi label="Late" value={k.late} tone={k.late ? 'late' : ''} to="/jobs" />
              <Kpi label="Finished this week" value={k.done_this_week} note={`${k.done_this_month} this month`} tone="good" />
              <Kpi label="Finished, all time" value={k.done_total} note={`${k.jobs_total} jobs ever made`} />
              <Kpi
                label="Customers"
                value={k.customers}
                note={k.new_customers_this_month ? `${k.new_customers_this_month} new this month` : 'none new this month'}
                to="/customers"
              />
              <Kpi label="Files" value={k.files} note="artwork & documents" to="/files" />
              <Kpi
                label="Voice today"
                value={k.voice_today}
                note={k.voice_understood == null ? 'no commands yet' : `${k.voice_understood}% understood`}
                to="/voice"
              />
            </div>

            <div className="dash-grid">
              <section className="panel">
                <h2>Jobs in each stage</h2>
                <p className="hint panel-sub">Jobs in progress, same stages as the TV.</p>
                <HBars
                  rows={data.by_stage.map((stage) => ({ key: stage.id, label: stage.name, value: stage.count, swatch: stage.color }))}
                  empty="No stages yet"
                />
              </section>

              <section className="panel">
                <h2>New and finished jobs</h2>
                <p className="hint panel-sub">Each week, the last 8 weeks.</p>
                <WeekColumns weeks={data.weeks} />
              </section>

              <section className="panel">
                <h2>Due soon</h2>
                <p className="hint panel-sub">Late jobs and the next 7 days.</p>
                {data.due_soon.length ? (
                  <ul className="dash-list">
                    {data.due_soon.map((job) => {
                      const due = dueWords(job.due_date, data.today);
                      return (
                        <li key={job.id}>
                          <span className="dash-dot" style={{ background: job.stage_color || '#8a93a1' }} />
                          <span className="dash-main">
                            <b>
                              {job.job_number} · {job.title}
                            </b>
                            <span className="hint">
                              {job.customer_name || 'No customer'} · {job.stage_name}
                            </span>
                          </span>
                          <span className={`dash-due ${due.tone}`}>{due.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="hint">Nothing due in the next 7 days.</p>
                )}
              </section>

              <section className="panel">
                <h2>Top customers</h2>
                <p className="hint panel-sub">Most jobs, all time.</p>
                <HBars
                  rows={data.top_customers.map((row) => ({
                    key: row.id,
                    label: row.name,
                    value: row.total,
                    extra: row.active ? `${row.active} in progress` : 'none in progress',
                  }))}
                  empty="No customers with jobs yet"
                />
              </section>

              <section className="panel span-2">
                <h2>Latest moves</h2>
                {data.recent.length ? (
                  <ul className="dash-list">
                    {data.recent.map((row, index) => (
                      <li key={`${row.at}-${index}`}>
                        <span className="dash-dot" style={{ background: row.stage_color || '#8a93a1' }} />
                        <span className="dash-main">
                          <b>
                            {row.job_number} · {row.title}
                          </b>
                          <span className="hint">
                            {row.created ? 'New job' : `Moved to ${row.stage_name}`}
                            {row.by ? ` · by ${row.by === 'voice' ? 'voice' : firstName(row.by)}` : ''}
                          </span>
                        </span>
                        <span className="dash-due">{whenWords(row.at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">Nothing has moved yet.</p>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {creating ? (
        <NewJobModal
          onClose={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}
    </>
  );
}
