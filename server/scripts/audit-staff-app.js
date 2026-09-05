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
    email: process.env.STAFF_EMAIL || 'verify.staff.1788604858658@printshop.com',
    password: process.env.STAFF_PASSWORD || 'Staff@12345',
  });
  if (error || !session.session?.access_token) {
    throw new Error(error?.message || 'Staff sign-in failed');
  }
  const token = session.session.access_token;
  const staffId = session.user?.id;

  const adminAuth = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL || 'admin@printshop.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  });
  const adminToken = adminAuth.data?.session?.access_token;

  const me = await call('/auth', 'GET', '/api/auth/me', { token });
  add('/auth', me.status === 200 && me.json?.data?.role === 'staff', `me ${me.status} role=${me.json?.data?.role}`);

  const jobs = await call('/jobs', 'GET', `/api/jobs?status=active&assigned=${staffId}&page=1&limit=5`, { token });
  const everyone = await call('/jobs', 'GET', '/api/jobs?status=active&page=1&limit=5', { token });
  const stages = await call('/jobs', 'GET', '/api/stages', { token });
  add(
    '/jobs',
    jobs.status === 200 && everyone.status === 200 && stages.status === 200,
    `mine ${jobs.status}, everyone ${everyone.status}, stages ${stages.status}`
  );

  const jobId = everyone.json?.data?.items?.[0]?.id;
  if (jobId) {
    const detail = await call('/jobs/:id', 'GET', `/api/jobs/${jobId}`, { token });
    const delJob = await call('/jobs/:id', 'DELETE', `/api/jobs/${jobId}`, { token });
    add(
      '/jobs/:id',
      detail.status === 200 && delJob.status === 403,
      `detail ${detail.status}, DELETE job ${delJob.status}`
    );

    const artworks = detail.json?.data?.artworks || [];
    const othersArt = artworks.find((row) => row.uploaded_by && row.uploaded_by !== staffId);
    if (othersArt) {
      const delArt = await call('art', 'DELETE', `/api/artworks/${othersArt.id}`, { token });
      add('DELETE others artwork', delArt.status === 403, `artwork delete ${delArt.status}`);
    } else {
      add('DELETE others artwork', true, 'no other-user artwork to probe (skipped)');
    }

    const notes = detail.json?.data?.notes || [];
    let othersNote = notes.find((row) => (row.author_id || row.author?.id) && (row.author_id || row.author?.id) !== staffId);
    if (!othersNote && adminToken) {
      const created = await call('note', 'POST', `/api/jobs/${jobId}/notes`, {
        token: adminToken,
        body: { content: 'Audit ownership note' },
      });
      othersNote = created.json?.data;
    }
    if (othersNote) {
      const delNote = await call('note', 'DELETE', `/api/notes/${othersNote.id}`, { token });
      add('DELETE others note', delNote.status === 403, `note delete ${delNote.status}`);
      if (adminToken) await call('note', 'DELETE', `/api/notes/${othersNote.id}`, { token: adminToken });
    } else {
      add('DELETE others note', false, 'could not create admin note to probe');
    }
  } else {
    add('/jobs/:id', false, 'no jobs to probe');
  }

  const customers = await call('/customers', 'GET', '/api/customers?page=1&limit=5', { token });
  const cstats = await call('/customers', 'GET', '/api/customers/stats', { token });
  const customerId = customers.json?.data?.items?.[0]?.id;
  const customer = customerId
    ? await call('/customers/:id', 'GET', `/api/customers/${customerId}`, { token })
    : { status: 0 };
  const delCust = customerId
    ? await call('/customers/:id', 'DELETE', `/api/customers/${customerId}`, { token })
    : { status: 0 };
  add(
    '/customers',
    customers.status === 200 && cstats.status === 200 && (!customerId || (customer.status === 200 && delCust.status === 403)),
    `list ${customers.status}, stats ${cstats.status}, detail ${customer.status || 'n/a'}, DELETE ${delCust.status || 'n/a'}`
  );

  const voice = await call('/voice', 'GET', '/api/voice/history?limit=10', { token });
  const omi = await call('/voice', 'GET', '/api/omi/setup-status', { token });
  add('/voice', voice.status === 200 && omi.status === 200, `history ${voice.status}, omi ${omi.status}`);

  const boardKey = await call('/board', 'GET', '/api/board/key', { token });
  const bstats = await call('/board', 'GET', '/api/board/stats', { token });
  add(
    '/board',
    boardKey.status === 200 && Boolean(boardKey.json?.data?.key) && bstats.status === 200,
    `key ${boardKey.status} present=${Boolean(boardKey.json?.data?.key)}, stats ${bstats.status}`
  );

  console.log('\nroute\t\tstatus\tnote');
  console.log('-----\t\t------\t----');
  for (const row of rows) {
    const pad = row.route.length < 8 ? '\t\t' : '\t';
    console.log(`${row.route}${pad}${row.status}\t${row.note}`);
  }

  if (rows.some((row) => row.status !== 'DONE')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
