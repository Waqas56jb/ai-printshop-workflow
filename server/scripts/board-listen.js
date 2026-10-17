// Joins the "board" room like a TV would and prints every event it receives.
// Usage: node scripts/board-listen.js [--url http://localhost:5000] [--origin http://localhost:5175]
// socket.io-client is borrowed from the worker app so the server needs no extra dependency.
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

dotenv.config();

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 || !process.argv[index + 1] ? fallback : process.argv[index + 1];
}

const require = createRequire(new URL('../../worker/package.json', import.meta.url));
const { io } = require('socket.io-client');

const url = arg('url', `http://localhost:${process.env.PORT || 5000}`);
const origin = arg('origin', 'http://localhost:5175');
const socket = io(url, { auth: { label: 'board-listen', preview: false }, extraHeaders: { Origin: origin } });

const stamp = () => new Date().toISOString().slice(11, 23);

socket.on('connect', () => {
  console.log(stamp(), `[board-listen] connected ${socket.id} -> ${url}`);
  socket.emit('join', 'board');
});
socket.on('connect_error', (error) => console.log(stamp(), '[board-listen] connect_error', error.message));
socket.on('disconnect', (reason) => console.log(stamp(), '[board-listen] disconnected', reason));
socket.onAny((event, payload) => {
  const shown = payload && typeof payload === 'object' ? { ...payload } : payload;
  if (shown?.audio_base64) shown.audio_base64 = `<${shown.audio_base64.length} b64 chars>`;
  if (shown?.artworks) shown.artworks = `<${shown.artworks.length} files>`;
  console.log(stamp(), `[board-listen] ${event}`, JSON.stringify(shown ?? null).slice(0, 400));
});
