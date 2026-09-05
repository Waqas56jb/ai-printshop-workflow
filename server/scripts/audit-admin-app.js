import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const rows = [];

async function call(route, method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { route, method, path, status: res.status, json };
}

function add(route, ok, note) {
  rows.push({ route, status: ok ? 'DONE' : 'FAIL', note });
}

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error } = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL || 'admin@printshop.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  });
  if (error || !session.session?.access_token) {
    throw new Error(error?.message || 'Admin sign-in failed');
  }
  const token = session.session.access_token;

  const unauth = await call('/login', 'GET', '/api/auth/me');
  add('/login', unauth.status === 401, '401 without token → clients redirect to /login');

  const me = await call('/login', 'GET', '/api/auth/me', { token });
  add(
    'Layout / auth',
    me.status === 200 && me.json?.data?.role === 'admin',
    me.status === 200 ? 'GET /api/auth/me admin OK' : `me=${me.status}`
  );

  const dash = await call('/', 'GET', '/api/dashboard/admin', { token });
  const voice = await call('/', 'GET', '/api/voice/history?limit=5', { token });
  add(
    '/',
    dash.status === 200 && voice.status === 200,
    `dashboard ${dash.status}, voice history ${voice.status}`
  );

  const jobs = await call('/jobs', 'GET', '/api/jobs?status=active&page=1&limit=5', { token });
  const stages = await call('/jobs', 'GET', '/api/stages', { token });
  const users = await call('/jobs', 'GET', '/api/users', { token });
  const assigned = await call('/jobs', 'GET', '/api/jobs?assigned=unassigned&page=1&limit=5', { token });
  add(
    '/jobs',
    jobs.status === 200 && stages.status === 200 && users.status === 200 && assigned.status === 200,
    `jobs ${jobs.status}, stages ${stages.status}, assigned filter ${assigned.status}`
  );

  const customer = await call('/jobs', 'POST', '/api/customers', {
    token,
    body: { name: `Audit ${Date.now()}` },
  });
  const defaultStage = (stages.json?.data || []).find((row) => row.is_default) || stages.json?.data?.[0];
  const created = customer.status < 300 && defaultStage
    ? await call('/jobs', 'POST', '/api/jobs', {
        token,
        body: {
          customer_id: customer.json.data.id,
          title: 'Audit cancel job',
          quantity: 1,
          stage_id: defaultStage.id,
        },
      })
    : { status: 0, json: {} };
  const createdId = created.json?.data?.id;
  if (createdId) {
    const cancelled = await call('/jobs/:id', 'PATCH', `/api/jobs/${createdId}`, {
      token,
      body: { status: 'cancelled' },
    });
    const cancelOk = cancelled.status === 200 && cancelled.json?.data?.status === 'cancelled';
    add('/jobs cancel', cancelOk, `PATCH status=cancelled → ${cancelled.status} ${cancelled.json?.data?.status || ''}`);
    await call('/jobs/:id', 'DELETE', `/api/jobs/${createdId}`, { token });
    await call('/customers', 'DELETE', `/api/customers/${customer.json.data.id}`, { token });
  } else {
    add('/jobs cancel', false, `could not create probe job (${created.status})`);
  }

  const jobId = jobs.json?.data?.items?.[0]?.id;
  if (jobId) {
    const detail = await call('/jobs/:id', 'GET', `/api/jobs/${jobId}`, { token });
    const notes = await call('/jobs/:id', 'GET', `/api/jobs/${jobId}/notes`, { token });
    const art = await call('/jobs/:id', 'GET', `/api/jobs/${jobId}/artworks`, { token });
    const cancelProbe = await call('/jobs/:id', 'PATCH', `/api/jobs/${jobId}`, {
      token,
      body: { title: jobs.json.data.items[0].title },
    });
    add(
      '/jobs/:id',
      detail.status === 200 && notes.status === 200 && art.status === 200 && cancelProbe.status === 200,
      `detail ${detail.status}, notes ${notes.status}, art ${art.status}, patch ${cancelProbe.status}`
    );

    const missing = await call('/jobs/:id', 'GET', '/api/jobs/00000000-0000-4000-8000-000000000000', { token });
    add('/jobs/:id not-found', missing.status === 404, `404 job = ${missing.status}`);
  } else {
    add('/jobs/:id', false, 'no jobs to probe');
  }

  const customers = await call('/customers', 'GET', '/api/customers?page=1&limit=5', { token });
  const cstats = await call('/customers', 'GET', '/api/customers/stats', { token });
  const customerId = customers.json?.data?.items?.[0]?.id;
  const customerDetail = customerId
    ? await call('/customers/:id', 'GET', `/api/customers/${customerId}`, { token })
    : { status: 0 };
  add(
    '/customers',
    customers.status === 200 && cstats.status === 200 && (!customerId || customerDetail.status === 200),
    `list ${customers.status}, stats ${cstats.status}, detail ${customerDetail.status || 'n/a'}`
  );

  const stageList = await call('/stages', 'GET', '/api/stages', { token });
  add('/stages', stageList.status === 200 && Array.isArray(stageList.json?.data), `stages ${stageList.status}`);

  const omi = await call('/voice', 'GET', '/api/omi/setup-status', { token });
  const hook = await call('/voice', 'GET', '/api/omi/webhook-url', { token });
  const debug = await call('/voice', 'GET', '/api/omi/debug', { token });
  const debug401 = await call('/voice', 'GET', '/api/omi/debug');
  add(
    '/voice',
    omi.status === 200 && hook.status === 200 && debug.status === 200 && debug401.status === 401,
    `setup ${omi.status}, webhook-url ${hook.status}, debug ${debug.status}, debug unauth ${debug401.status}`
  );

  const staff = await call('/staff', 'GET', '/api/users', { token });
  const ustats = await call('/staff', 'GET', '/api/users/stats', { token });
  add('/staff', staff.status === 200 && ustats.status === 200, `users ${staff.status}, stats ${ustats.status}`);

  const settings = await call('/settings', 'GET', '/api/settings', { token });
  const refresh = settings.json?.data?.board_refresh_seconds;
  add(
    '/settings',
    settings.status === 200 && refresh != null,
    `settings ${settings.status}, board_refresh_seconds=${refresh}`
  );

  const board = await call('/board', 'GET', '/api/board', { token });
  const bstats = await call('/board', 'GET', '/api/board/stats', { token });
  const screens = await call('/board', 'GET', '/api/board/screens', { token });
  add(
    '/board',
    board.status === 200 && bstats.status === 200 && screens.status === 200,
    `board ${board.status}, stats ${bstats.status}, screens ${screens.status}`
  );

  const forbidden = await call('403', 'DELETE', '/api/jobs/cleanup', {});
  add('401/403', forbidden.status === 401, `admin-only cleanup without token → ${forbidden.status}`);

  console.log('\nroute\t\tstatus\tnote');
  console.log('-----\t\t------\t----');
  for (const row of rows) {
    const pad = row.route.length < 8 ? '\t\t' : '\t';
    console.log(`${row.route}${pad}${row.status}\t${row.note}`);
  }

  const failed = rows.filter((row) => row.status !== 'DONE');
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
