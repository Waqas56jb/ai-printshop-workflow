# Print Shop — panel

The one panel for the shop (admin and staff accounts sign in here with the same permissions).
Design: `design/admin-v2.html`. Left sidebar, big type, plain words. Four sections:

- **Jobs** (`/`) — one column per real stage (same order and colors as the TV) plus Done (last 20).
  Each card has one button: "→ next stage", or "Done ✓" on the last stage. Admins get "Edit stages".
- **Files** (`/files`) — customer folders → job folders → files. Files uploaded into a job folder are
  that job's files: they show on the job card and the TV right away.
- **Customers** (`/customers`), **Voice** (`/voice`) — next phase.

The TV board lives in `/worker`; the API in `/server`.

```bash
npm install
cp .env.example .env   # VITE_API_URL, VITE_WORKER_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```
