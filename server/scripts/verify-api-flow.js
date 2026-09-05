import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const results = [];

function nextFriday() {
  const date = new Date();
  const day = date.getDay();
  const add = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + add);
  return date.toISOString().slice(0, 10);
}

async function request(name, method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  const entry = { name, method, path, status: res.status, json };
  results.push(entry);
  console.log(`\n=== ${name} ${method} ${path} → ${res.status} ===`);
  console.log(JSON.stringify(json, null, 2));
  return entry;
}

function expect(entry, ok, detail) {
  entry.pass = Boolean(ok);
  entry.detail = detail;
  console.log(ok ? `PASS: ${entry.name}` : `FAIL: ${entry.name} — ${detail}`);
}

async function main() {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is missing; cannot sign in');
  }

  const supabase = createClient(process.env.SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error } = await supabase.auth.signInWithPassword({
    email: 'admin@printshop.com',
    password: 'Admin@12345',
  });
  if (error || !session.session?.access_token) {
    throw new Error(error?.message || 'Sign-in failed');
  }
  const token = session.session.access_token;
  console.log('Signed in; JWT acquired (masked).');

  const me = await request('auth/me', 'GET', '/api/auth/me', { token });
  expect(me, me.status === 200 && me.json?.data?.role === 'admin', 'expected 200 role=admin');

  const stages = await request('stages', 'GET', '/api/stages', { token });
  const stageRows = stages.json?.data || [];
  expect(stages, stages.status === 200 && stageRows.length === 7, `expected 7 stages, got ${stageRows.length}`);
  const printing = stageRows.find((row) => row.slug === 'printing' || row.name === 'Printing');

  const customer = await request('create customer', 'POST', '/api/customers', {
    token,
    body: { name: 'Sarah Khan', phone: '03001234567' },
  });
  expect(customer, customer.status === 201 && customer.json?.data?.id, 'expected 201 with customer id');
  const customerId = customer.json?.data?.id;

  const job = await request('create job', 'POST', '/api/jobs', {
    token,
    body: {
      customer_id: customerId,
      title: '50 T-Shirts',
      product_type: 'T-Shirt',
      quantity: 50,
      due_date: nextFriday(),
      priority: 'normal',
    },
  });
  const jobNumber = job.json?.data?.job_number;
  expect(
    job,
    job.status === 201 && /^J-\d+$/.test(jobNumber || ''),
    `expected 201 J-####, got ${job.status} ${jobNumber}`
  );
  const jobId = job.json?.data?.id;

  const moved = await request('move stage', 'PATCH', `/api/jobs/${jobId}/stage`, {
    token,
    body: { stage_id: printing?.id, source: 'manual' },
  });
  expect(
    moved,
    moved.status === 200 && (moved.json?.data?.stage?.slug === 'printing' || moved.json?.data?.stage_id === printing?.id),
    'expected job on Printing'
  );

  const board = await request('board after move', 'GET', '/api/board');
  const printingColumn = (board.json?.data || []).find((col) => col.slug === 'printing');
  const onBoard = (printingColumn?.jobs || []).some((item) => item.id === jobId || item.job_number === jobNumber);
  expect(board, board.status === 200 && onBoard, 'expected job under Printing on board');

  const voice = await request('voice note', 'POST', '/api/voice/command', {
    token,
    body: { transcript: "add note to Sarah's job use black ink" },
  });
  const voiceOk =
    voice.status === 200 &&
    (voice.json?.data?.command?.action === 'add_note' ||
      voice.json?.data?.result?.content ||
      /note|black ink/i.test(JSON.stringify(voice.json)));
  expect(voice, voiceOk, 'expected voice command to add a note');

  const history = await request('voice history', 'GET', '/api/voice/history', { token });
  const items = history.json?.data?.items || [];
  expect(history, history.status === 200 && items.length >= 1, 'expected at least one voice history row');

  const failed = results.filter((row) => row.pass === false);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
