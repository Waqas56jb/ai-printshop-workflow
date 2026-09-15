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

const sessionId = `sim-${Date.now()}`;
const url = `${base}/api/omi/webhook?uid=${encodeURIComponent(uid)}&secret=${encodeURIComponent(secret)}&session_id=${encodeURIComponent(sessionId)}`;
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    segments: [{ text, speaker: 'SPEAKER_0', is_user: true, start: 0, end: 1.6 }],
  }),
});
const body = await response.text();
let json = body;
try {
  json = JSON.parse(body);
} catch {
  /* keep raw */
}
console.log(response.status, JSON.stringify(json));
