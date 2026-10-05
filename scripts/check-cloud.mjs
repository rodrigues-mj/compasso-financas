import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const result = await client.from('finance_documents').select('space_id').limit(1);
assert.ok(result.error, 'Consulta anônima deveria ser bloqueada');
assert.notEqual(result.error.code, 'PGRST205', 'A migração precisa ser instalada');
const rpc = await client.rpc('finance_create_space', { p_name: 'Verificação anônima', p_initial: {} });
assert.ok(rpc.error, 'A criação anônima deveria ser bloqueada');
console.log('Supabase conectado: tabelas instaladas; consulta e criação sem login bloqueadas. Nenhum registro foi criado.');
