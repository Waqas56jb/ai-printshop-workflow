import dotenv from 'dotenv';

dotenv.config();

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const uid = arg('uid', 'omi_sim');
const text = arg('text', "what's due today");
const base = (arg('url') || process.env.OMI_SIM_URL || `http://localhost:${process.env.PORT || 5000}`).replace(
  /\/$/,
  ''
);
const secret = arg('secret') || process.env.OMI_WEBHOOK_SECRET || '';

if (!secret) {
  console.error('OMI_WEBHOOK_SECRET is missing. Set it in server/.env or pass --secret');
  process.exit(1);
}

const words = text.trim().split(/\s+/);
const mid = Math.max(1, Math.ceil(words.length / 2));
const chunks = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean);
const sessionId = `sim-${Date.now()}`;

async function postChunk(part, start, end) {
  const url = `${base}/api/omi/webhook?uid=${encodeURIComponent(uid)}&secret=${encodeURIComponent(secret)}&session_id=${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      segments: [{ text: part, speaker: 'SPEAKER_0', is_user: true, start, end }],
    }),
  });
  const body = await response.text();
  let json = body;
  try {
    json = JSON.parse(body);
  } catch {
    /* keep raw */
  }
  return { status: response.status, json };
}

const pending = [postChunk(chunks[0], 0, 0.8)];
if (chunks[1]) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  pending.push(postChunk(chunks[1], 0.8, 1.6));
}
const results = await Promise.all(pending);
results.forEach((row, index) => {
  console.log(`chunk ${index + 1}`, row.status, row.json);
});
