# Print Shop — panel

The one panel for the shop (admin and staff accounts sign in here with the same permissions).
Big type, big buttons, plain words. Four tabs:

- **Jobs** (`/`) — New / Working / Ready / Done. A view over the real stages: New = default stage,
  Ready = the stage named "Ready", Done = the last 20 finished jobs, Working = everything in between.
- **Files** (`/files`), **Customers** (`/customers`), **Voice** (`/voice`) — next phase.

The TV board lives in `/worker`; the API in `/server`.

```bash
npm install
cp .env.example .env   # VITE_API_URL, VITE_WORKER_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```
