# Worker / TV job board

Fullscreen shop display. Default: **public** — open `http://localhost:5175/` with no query string.

```bash
cd worker
cp .env.example .env
npm install
npm run dev
```

Port **5175**. `VITE_API_URL` should point at the server (`http://localhost:5000`).

## Access

- `board_public=true` (default): `http://localhost:5175/` loads the live board.
- `board_public=false`: plain URL shows “needs a board link”. Use the Admin key URL (`/?key=…`).

The board polls `/api/board` and joins the Socket.IO `board` room (sends a key only when one is in the URL). Press **F** for fullscreen.
