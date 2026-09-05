# Staff panel

Vite app on port **5174**.

```bash
cd staff
cp .env.example .env
npm install
npm run dev
```

`VITE_API_URL` should point at the server (`http://localhost:5000`).

## Voice assistant

The **Talk** button (left of New job) starts an OpenAI Realtime speech-to-speech session in the browser (WebRTC). The server mints an ephemeral client secret via `POST /api/realtime/session`; the API key never reaches the browser.

- `VITE_REALTIME_ENABLED` defaults to `true`. Set `false` to hide Talk.
- `getUserMedia` needs **HTTPS or localhost**.
- Works best in Chrome. Allow the microphone when asked.
- Say **stop** or press End to close the session.

The assistant calls the same shop tools as OMI (due today, move stage, notes, create job). Confirmations and job-choice chips appear in the floating panel.
