import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';
import * as settingsService from '../src/modules/settings/settings.service.js';

const API = 'http://localhost:5000';
const WORKER = 'http://localhost:5175/';
const FORBIDDEN = /price|notes|email|phone/i;

async function adminToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.VERIFY_ADMIN_EMAIL,
    password: process.env.VERIFY_ADMIN_PASSWORD,
  });
  if (!error && data?.session?.access_token) return data.session.access_token;

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: process.env.VERIFY_ADMIN_EMAIL,
  });
  if (linkError) throw linkError;
  const hash = link?.properties?.hashed_token;
  if (!hash) throw new Error('Could not create admin session');
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await anon.auth.verifyOtp({ token_hash: hash, type: 'magiclink' });
  if (verified.error || !verified.data?.session?.access_token) {
    throw verified.error || new Error('OTP verify failed');
  }
  return verified.data.session.access_token;
}

function jobStageMap(board) {
  const map = new Map();
  for (const stage of board.stages || []) {
    for (const job of stage.jobs || []) {
      map.set(job.id, {
        jobId: job.id,
        stageId: stage.id,
        stageName: stage.name,
        jobNumber: job.job_number,
      });
    }
  }
  return map;
}

function assertSafePayload(board) {
  const json = JSON.stringify(board);
  if (FORBIDDEN.test(json)) {
    throw new Error('Board payload contains forbidden fields');
  }
  const job = board.stages?.flatMap((stage) => stage.jobs || [])[0];
  if (job) {
    for (const key of ['price', 'notes', 'email', 'phone', 'customer_email', 'customer_phone']) {
      if (key in job) throw new Error(`Job leaked ${key}`);
    }
  }
}

async function getBoard(key = '') {
  const url = key ? `${API}/api/board?key=${encodeURIComponent(key)}` : `${API}/api/board`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  process.env.VERIFY_ADMIN_EMAIL ||= 'admin@printshop.com';
  process.env.VERIFY_ADMIN_PASSWORD ||= 'Admin@12345';

  await settingsService.writeSetting('board_public', true);
  const settings = await settingsService.getSettings();
  if (settings.board_public !== true) throw new Error('board_public did not persist as true');

  const open = await getBoard();
  if (open.status !== 200) throw new Error(`public GET /api/board expected 200, got ${open.status}`);
  assertSafePayload(open.body.data);
  console.log(
    `public_board=200 shop=${open.body.data.shop?.name} stages=${open.body.data.stages?.length} jobs=${
      open.body.data.stages?.reduce((n, stage) => n + (stage.jobs?.length || 0), 0)
    }`
  );

  const token = await adminToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const settingsRes = await fetch(`${API}/api/settings`, { headers });
  const settingsBody = await settingsRes.json();
  if (settingsRes.status !== 200) throw new Error(`GET /api/settings ${settingsRes.status}`);
  if (settingsBody.data?.board_public !== true) throw new Error('GET /api/settings missing board_public=true');
  console.log('get_settings_board_public=true');

  const before = jobStageMap(open.body.data);
  const movable = [...before.values()][0];
  const otherStage = (open.body.data.stages || []).find((stage) => stage.id !== movable?.stageId);
  if (movable && otherStage) {
    const moveRes = await fetch(`${API}/api/jobs/${movable.jobId}/stage`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ stage_id: otherStage.id }),
    });
    if (!moveRes.ok) throw new Error(`move job failed ${moveRes.status}`);
    const after = await getBoard();
    const moved = jobStageMap(after.body.data).get(movable.jobId);
    if (moved?.stageId !== otherStage.id) throw new Error('board did not reflect job move');
    console.log(`job_move_live ${moved.jobNumber} -> ${moved.stageName}`);
    await fetch(`${API}/api/jobs/${movable.jobId}/stage`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ stage_id: movable.stageId }),
    });
  } else {
    console.log('job_move_skipped no jobs');
  }

  const off = await fetch(`${API}/api/settings`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ board_public: false }),
  });
  if (!off.ok) throw new Error(`PATCH board_public false ${off.status}`);
  const locked = await getBoard();
  if (locked.status !== 401) throw new Error(`private GET /api/board expected 401, got ${locked.status}`);
  const key = (await settingsService.getSetting('board_key', '')) || '';
  const keyed = await getBoard(key);
  if (keyed.status !== 200) throw new Error(`keyed GET /api/board expected 200, got ${keyed.status}`);
  console.log('private_plain=401 keyed=200');

  const on = await fetch(`${API}/api/settings`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ board_public: true }),
  });
  if (!on.ok) throw new Error(`PATCH board_public true ${on.status}`);

  const worker = await fetch(WORKER);
  if (!worker.ok) throw new Error(`worker ${worker.status}`);
  const html = await worker.text();
  if (!html.includes('root') && !html.includes('Job board')) {
    throw new Error('worker HTML unexpected');
  }
  console.log('worker_html=200');
  console.log('ok');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
