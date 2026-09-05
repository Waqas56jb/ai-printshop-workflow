import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config();

const REQUIRED_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];

const OPTIONAL_KEYS = ['PORT', 'OMI_WEBHOOK_SECRET', 'CLIENT_ORIGINS'];

function mask(value) {
  if (!value) return '(empty)';
  const visible = value.slice(0, 6);
  return `${visible}${'•'.repeat(Math.max(0, value.length - 6))}`;
}

function fail(message, error) {
  console.error(`\nFAIL: ${message}`);
  if (error) {
    console.error(error instanceof Error ? error.stack || error.message : error);
  }
  process.exit(1);
}

function printEnvKeys() {
  console.log('=== Env keys ===');
  const missing = [];

  for (const key of [...REQUIRED_KEYS, ...OPTIONAL_KEYS]) {
    const value = process.env[key];
    const present = Boolean(value && String(value).trim());
    if (!present && REQUIRED_KEYS.includes(key)) missing.push(key);
    console.log(
      `  ${present ? 'OK ' : 'MISS'} ${key} = ${present ? mask(String(value)) : '(missing)'}`
    );
  }

  if (missing.length) {
    fail(`Missing required env key(s): ${missing.join(', ')}`);
  }
}

async function checkTables(supabase) {
  console.log('\n=== Supabase table counts ===');
  const tables = ['profiles', 'customers', 'stages', 'jobs', 'voice_commands', 'settings'];

  for (const table of tables) {
    // Prefer a real SELECT. Prefer+count HEAD returns 204 with no error when
    // the table is missing from the PostgREST schema cache.
    const result = await supabase.from(table).select('*', { count: 'exact' }).limit(0);
    const error = result.error;
    const notFound =
      result.status === 404 ||
      error?.code === 'PGRST205' ||
      error?.code === '42P01' ||
      /could not find the table|relation .* does not exist/i.test(error?.message || '');

    if (notFound) {
      fail(
        `Table "${table}" is missing. The migration was not run. Run server/supabase/migrations/001_schema.sql then 002_seed.sql in the Supabase SQL Editor.`,
        error || { status: result.status, statusText: result.statusText }
      );
    }

    if (error || result.status >= 400) {
      fail(
        `Supabase query failed on "${table}" (check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)`,
        error || { status: result.status, statusText: result.statusText }
      );
    }

    console.log(`  ${table}: ${result.count ?? 0}`);
  }
}

async function checkStorage(supabase) {
  console.log('\n=== Storage buckets ===');
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    fail('Failed to list storage buckets (check SUPABASE_SERVICE_ROLE_KEY)', error);
  }

  const names = (buckets || []).map((bucket) => bucket.name);
  console.log(`  existing: ${names.length ? names.join(', ') : '(none)'}`);

  let artworks = (buckets || []).find((bucket) => bucket.name === 'artworks');
  if (!artworks) {
    console.log('  artworks missing — creating as public...');
    const { data, error: createError } = await supabase.storage.createBucket('artworks', {
      public: true,
    });
    if (createError) {
      fail('Failed to create artworks bucket', createError);
    }
    artworks = data;
  }

  if (!artworks.public) {
    const { error: updateError } = await supabase.storage.updateBucket('artworks', { public: true });
    if (updateError) {
      fail('artworks bucket exists but could not be set public', updateError);
    }
    console.log('  artworks: exists (updated to public)');
  } else {
    console.log('  artworks: exists (public)');
  }
}

async function checkOpenAI() {
  console.log('\n=== OpenAI ===');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    fail('OPENAI_API_KEY is missing');
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'reply with OK' }],
    max_tokens: 8,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    fail('OpenAI returned an empty response');
  }
  console.log(`  model: gpt-4o-mini`);
  console.log(`  response: ${text}`);
}

async function main() {
  try {
    printEnvKeys();

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      fail('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await checkTables(supabase);
    await checkStorage(supabase);
    await checkOpenAI();

    console.log('\nAll connection checks passed.');
  } catch (error) {
    fail(error.message || 'Unexpected error', error);
  }
}

main();
