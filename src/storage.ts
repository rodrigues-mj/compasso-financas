import { createClient, type Session } from '@supabase/supabase-js';
import { emptyState, suggestedCategories, validateState, type State, type Member, type Role } from './domain';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key && !key.includes('SUA-CHAVE') ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } }) : null;
export type Space = { id: string; name: string };
export type Snapshot = { data: State; revision: number };
export const DEMO_USER = '00000000-0000-4000-8000-000000000001';
const DEMO_SPACE = '00000000-0000-4000-8000-000000000002';
export const demoMember: Member = { userId: DEMO_USER, name: 'Você (exemplo)', email: 'exemplo@local', role: 'admin', active: true };
function check<T>(response: { data: T; error: { message: string } | null }): T { if (response.error) throw new Error(response.error.message); return response.data; }
export async function spaces(): Promise<Space[]> {
  return check(await supabase!.from('finance_spaces').select('id,name').order('created_at')) || [];
}
export async function members(spaceId: string): Promise<Member[]> {
  const rows = check(await supabase!.from('finance_members').select('*').eq('space_id', spaceId)) || [];
  return rows.map(r => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role as Role, active: r.active }));
}
export async function load(spaceId: string): Promise<Snapshot> {
  const row = check(await supabase!.from('finance_documents').select('data,revision').eq('space_id', spaceId).single());
  if (!row) throw new Error('Espaço não encontrado ou acesso removido.');
  return { data: validateState(row.data), revision: Number(row.revision) };
}
export async function save(spaceId: string, snapshot: Snapshot, data: State, restore = false): Promise<Snapshot> {
  const parsed = validateState(data);
  const revision = check(await supabase!.rpc('finance_save', { p_space: spaceId, p_revision: snapshot.revision, p_data: parsed, p_restore: restore }));
  return { data: parsed, revision: Number(revision) };
}
export async function createSpace(name: string): Promise<string> {
  return check(await supabase!.rpc('finance_create_space', { p_name: name, p_initial: { ...emptyState(), categories: suggestedCategories() } }));
}
export async function invite(spaceId: string, email: string, role: Role): Promise<string> {
  const token = check(await supabase!.rpc('finance_invite', { p_space: spaceId, p_email: email, p_role: role }));
  return `${location.origin}/?invite=${token}`;
}
export async function acceptInvite(token: string) { return check(await supabase!.rpc('finance_accept_invite', { p_token: token })); }
export async function changeMember(spaceId: string, member: Member, role: Role, active: boolean) {
  check(await supabase!.rpc('finance_set_member', { p_space: spaceId, p_user: member.userId, p_role: role, p_active: active }));
}
export async function getSession(): Promise<Session | null> { return supabase ? (await supabase.auth.getSession()).data.session : null; }

// IndexedDB is exclusively for explicitly selected fictional examples, never the real financial source.
async function demoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('compasso-exemplos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('demo');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function demoLoad(): Promise<Snapshot | null> {
  const db = await demoDb();
  return new Promise((resolve, reject) => { const tx = db.transaction('demo'); const req = tx.objectStore('demo').get(DEMO_SPACE); req.onsuccess = () => resolve(req.result ? { ...req.result, data: validateState(req.result.data) } : null); req.onerror = () => reject(req.error); tx.oncomplete = () => db.close(); });
}
export async function demoSave(snapshot: Snapshot, data: State): Promise<Snapshot> {
  const db = await demoDb(); const result = { data: validateState(data), revision: snapshot.revision + 1 };
  return new Promise((resolve, reject) => { const tx = db.transaction('demo', 'readwrite'); const store = tx.objectStore('demo'); const req = store.get(DEMO_SPACE); req.onsuccess = () => { if (req.result && req.result.revision !== snapshot.revision) { tx.abort(); return; } store.put(result, DEMO_SPACE); }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onabort = () => { db.close(); reject(new Error('Outra aba alterou os exemplos. Atualize antes de salvar.')); }; tx.onerror = () => reject(tx.error); });
}
export async function clearDemo() { const db = await demoDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction('demo', 'readwrite'); tx.objectStore('demo').delete(DEMO_SPACE); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }); }
export function download(name: string, data: string, type: string) { const blob = new Blob([data], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function backup(state: State, space: Space) { download(`compasso-${space.name.replace(/[^\p{L}\p{N}]/gu, '-')}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'compasso-backup', version: 1, exportedAt: new Date().toISOString(), spaceName: space.name, data: state }, null, 2), 'application/json'); }
