import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const [email, password, ...nameParts] = process.argv.slice(2);
const full_name = nameParts.join(' ').trim();

if (!email || !password || !full_name) {
  console.error('Usage: npm run create-admin -- <email> <password> <full_name>');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(targetEmail) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === targetEmail)?.id || null;
}

async function main() {
  let userId;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'admin' },
  });

  if (error) {
    const exists = /already been registered|already exists/i.test(error.message);
    if (!exists) {
      console.error(error.message);
      process.exit(1);
    }

    userId = await findUserIdByEmail(email);
    if (!userId) {
      console.error(error.message);
      process.exit(1);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'admin' },
    });
    if (updateError) {
      console.error(updateError.message);
      process.exit(1);
    }
  } else {
    userId = data.user.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name,
        role: 'admin',
        is_active: true,
        invite_status: 'active',
      },
      { onConflict: 'id' }
    )
    .select('id, email, full_name, role, is_active')
    .single();

  if (profileError) {
    console.error(profileError.message);
    process.exit(1);
  }

  console.log(JSON.stringify(profile, null, 2));
}

main();
