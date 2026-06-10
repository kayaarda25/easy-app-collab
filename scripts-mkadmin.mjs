import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });
const email = 'info@flatch.ch';
const password = 'Nalathedog1_';
let { data: list } = await sb.auth.admin.listUsers();
let user = list.users.find(u => u.email === email);
if (!user) {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error(error); process.exit(1); }
  user = data.user;
  console.log('created', user.id);
} else {
  await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  console.log('updated', user.id);
}
for (const role of ['admin','super_admin']) {
  const { error } = await sb.from('user_roles').upsert({ user_id: user.id, role }, { onConflict: 'user_id,role' });
  if (error) console.error(role, error); else console.log('role added', role);
}
