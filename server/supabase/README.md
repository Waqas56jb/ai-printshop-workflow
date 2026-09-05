# Supabase setup

The Express server talks to Supabase with the **service role** key. Run these SQL files in the Supabase dashboard; do not run them from the Node app.

## 1. Open the SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Open the **AI Print Shop** project
3. Click **SQL Editor** → **New query**

## 2. Run the schema

1. Paste the contents of `migrations/001_schema.sql`
2. Click **Run**
3. Confirm there are no errors

This creates tables, the `J-1025` job-number sequence, `updated_at` triggers, RLS, the `artworks` storage bucket (public read), and a trigger that inserts a `profiles` row when a new Auth user is created.

## 3. Run the seed

1. New query → paste `migrations/002_seed.sql`
2. Click **Run**

Default stages (in order): Quote → Approved → Artwork → Printing → QC → Ready → Delivered  
Settings: `voice_auto_execute=true`, `voice_trigger_word=""`, `board_refresh_seconds=30`, `business_name="Print Shop"`

## 4. Create the first admin

1. **Authentication → Users → Add user** (email + password)
2. Run:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

More staff/worker accounts should be created from the Admin panel via `POST /api/auth/register-staff`.

## 5. Storage

`001_schema.sql` creates a public bucket named `artworks`. Uploads are stored at `artworks/{jobId}/{uuid}-{filename}`.
