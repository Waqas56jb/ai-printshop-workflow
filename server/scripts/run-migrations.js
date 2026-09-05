import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../supabase/migrations');

function sessionPoolerUrl(url) {
  return url.replace(':6543/', ':5432/');
}

function directUrl() {
  const password = process.env.DATABASE_PASSWORD;
  const match = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!password || !match) return null;
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${match[1]}.supabase.co:5432/postgres`;
}

async function runWithUrl(connectionString, label) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Connected via ${label}`);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await client.query(sql);
    console.log(`Ran ${file}`);
  }

  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Sent schema reload notify');
  } catch (error) {
    console.warn(`NOTIFY failed (${error.message}). PostgREST may need a minute to refresh.`);
  }

  await client.end();
}

async function main() {
  const urls = [
    [directUrl(), 'direct db host'],
    [sessionPoolerUrl(process.env.DATABASE_URL), 'pooler :5432'],
    [process.env.DATABASE_URL, 'pooler :6543'],
  ].filter(([url]) => url);

  let lastError;
  for (const [url, label] of urls) {
    try {
      await runWithUrl(url, label);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`${label} failed: ${error.message}`);
    }
  }

  console.error(lastError?.message || 'All database connection attempts failed');
  process.exit(1);
}

main();
