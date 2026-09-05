# AI Print Shop Workflow — server

Express + Socket.io API for the Admin, Staff, and Worker (TV) panels. Database is Supabase (Postgres + Storage).

## Setup

```bash
cd server
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OMI_WEBHOOK_SECRET, CLIENT_ORIGINS
npm install
```

Run the SQL in `supabase/migrations/` (see `supabase/README.md`), then:

```bash
npm run dev
```

Server listens on `PORT` (default 5000). Health check: `GET /health`.

## Auth

Frontend signs in with Supabase Auth and sends `Authorization: Bearer <access_token>`. The server verifies the JWT and loads `profiles.role` (`admin` | `staff` | `worker`).

Public (no JWT): `GET /api/board` (when `board_public=true`, or with `?key=`), `POST /api/omi/webhook`, `GET /api/omi/setup-status`.

## Sockets

Same HTTP server. Rooms: `board`, `staff`, `admin`.

- Worker board: `socket.emit('join', 'board')`
- Staff/admin: send `auth: { token }` on connect; they are joined to their role room automatically

Events: `job:created`, `job:updated`, `job:moved`, `job:deleted`, `voice:command`, `board:refresh`.

## API list

Base URL: `http://localhost:5000`

All JSON responses: `{ success, data, message }` unless noted.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | `{ status: "ok" }` |

### Auth

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/register-staff` | admin | `{ email, password, full_name, role?, omi_uid? }` | Create Auth user + profile (`role`: staff\|worker) |
| GET | `/api/auth/me` | any logged-in | | Current profile |

### Users

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| GET | `/api/users` | admin | | List profiles |
| PATCH | `/api/users/:id` | admin | `{ role?, is_active?, omi_uid? }` | Update profile |
| DELETE | `/api/users/:id` | admin | | Delete Auth user + profile |

### Customers

| Method | Path | Auth | Query / Body | Description |
|--------|------|------|--------------|-------------|
| GET | `/api/customers` | admin+staff | `search, page, limit` | Paginated list |
| POST | `/api/customers` | admin+staff | `{ name, email?, phone?, company?, notes? }` | Create |
| GET | `/api/customers/:id` | admin+staff | | Get one |
| PATCH | `/api/customers/:id` | admin+staff | same as create, partial | Update |
| DELETE | `/api/customers/:id` | admin | | Delete |

### Stages

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| GET | `/api/stages` | any logged-in | | List in position order |
| POST | `/api/stages` | admin | `{ name, slug?, color?, position?, is_default?, is_final? }` | Create |
| PATCH | `/api/stages/reorder` | admin | `{ ids: uuid[] }` | Set position from array order |
| PATCH | `/api/stages/:id` | admin | partial stage fields | Update |
| DELETE | `/api/stages/:id` | admin | | Delete if unused |

### Jobs

| Method | Path | Auth | Query / Body | Description |
|--------|------|------|--------------|-------------|
| GET | `/api/jobs` | admin+staff | `stage, customer, status, priority, due_from, due_to, search, page, limit` | Filtered list |
| POST | `/api/jobs` | admin+staff | `{ customer_id, title, product_type?, quantity?, print_type?, size_details?, price?, priority?, stage_id?, assigned_to?, due_date?, notes? }` | Create (`J-####`) |
| GET | `/api/jobs/:id` | admin+staff | | Job + customer, stage, artworks, notes, history |
| PATCH | `/api/jobs/:id` | admin+staff | partial job fields | Update |
| PATCH | `/api/jobs/:id/stage` | admin+staff | `{ stage_id, source? }` | Move stage (`source`: manual\|voice) |
| PATCH | `/api/jobs/:id/assign` | admin+staff | `{ assigned_to }` | Assign staff |
| PATCH | `/api/jobs/:id/complete` | admin+staff | | Mark complete / move to final stage |
| DELETE | `/api/jobs/:id` | admin | | Delete |

### Artwork

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/jobs/:id/artworks` | admin+staff | multipart `file` (max 20mb; images, pdf, ai, svg) | Upload to Storage `artworks/{jobId}/...` |
| GET | `/api/jobs/:id/artworks` | admin+staff | | List versions |
| PATCH | `/api/artworks/:id/approve` | admin+staff | | Set `is_approved` |
| DELETE | `/api/artworks/:id` | admin+staff | | Delete file + row |

### Notes

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/jobs/:id/notes` | admin+staff | `{ content }` | Add note |
| GET | `/api/jobs/:id/notes` | admin+staff | | List notes |
| DELETE | `/api/notes/:id` | admin+staff | | Delete note |

### Board (TV)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/board` | none if `board_public=true`, else `?key=` or admin/staff JWT | TV payload (name, job number, title, qty, due, stage, initials). Rate-limited 120/min per IP. No prices, notes, emails, or phones. |

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/admin` | admin | Totals, jobs per stage, overdue, completed this week, staff activity, recent voice commands |
| GET | `/api/dashboard/staff` | admin+staff | My jobs, due today, due this week, overdue |

### Voice

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/voice/command` | admin+staff | `{ transcript }` | Run GPT intent pipeline |
| GET | `/api/voice/history` | admin+staff | `page, limit` | Voice command log |
| PATCH | `/api/voice/:id/confirm` | admin+staff | | Execute a pending command |
| PATCH | `/api/voice/:id/reject` | admin+staff | | Reject a pending command |

### OMI

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/omi/webhook?uid=` | `x-omi-secret` (or Bearer / `?secret=`) | Buffer transcript segments ~1.2s, then run intent. Response `{ message }` (must be >5 chars — that is what OMI speaks/notifies). |
| GET | `/api/omi/setup-status` | none | Whether webhook secret is set + profiles with `omi_uid` |

### Settings

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| GET | `/api/settings` | admin | | Flat key/value object |
| PATCH | `/api/settings` | admin | `{ board_public?, voice_auto_execute?, voice_trigger_word?, board_refresh_seconds?, business_name? }` | Upsert keys. `board_public` (default true) lets the TV open without a key. |
