import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, CalendarClock, Users, Tag, PieChart, BarChart3, Settings, ChevronDown, ChevronRight, Plus, Bell, LogOut, RefreshCw, CheckCircle2, X, ArrowRight, Copy, Download, ShieldCheck, Menu, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import * as D from './domain';
import * as S from './storage';
import { demoData } from './demo';
import { Modal, Field, Empty, EntryTable, StatusBadge } from './components';
import { EntryForm, EntityForm, PaymentForm, ReceiptForm, ReceiptGuide, RefundForm, BudgetForm, SettleForm, ReturnForm } from './forms';
import { Dashboard, Transactions, Cards, Thirds, Entities, Budgets, Reports, type PageProps } from './pages';
import installationSql from '../supabase/migrations/001_compasso.sql?raw';
import invitationSql from '../supabase/migrations/002_convites.sql?raw';

const NAV = [
  ['dashboard', 'Painel', LayoutDashboard], ['transactions', 'Lançamentos', ArrowLeftRight], ['banks', 'Bancos', Landmark], ['cards', 'Cartões e faturas', CreditCard], ['bills', 'Contas a pagar', CalendarClock], ['thirds', 'Valores a receber', Users], ['categories', 'Categorias', Tag], ['budgets', 'Orçamentos', PieChart], ['reports', 'Relatórios', BarChart3], ['settings', 'Configurações', Settings]
] as const;
type Page = typeof NAV[number][0];
type Dialog = { type: 'entry'; entry?: D.Entry; kind?: 'income' | 'expense'; cardId?: string } | { type: 'entity'; collection: 'banks' | 'cards' | 'categories' | 'contacts'; entity?: D.Entity } | { type: 'payment'; inv: D.Invoice } | { type: 'receipt'; entryId?: string; contactId?: string } | { type: 'return'; receiptId: string; entryId: string; contactId: string } | { type: 'refund' | 'settle' | 'detail'; entry: D.Entry } | { type: 'budget'; budget?: D.Budget } | { type: 'entries'; title: string; entries: D.Entry[] } | { type: 'space' | 'alerts' };
const titles: Record<Page, string> = { dashboard: 'Uma visão clara do seu dinheiro.', transactions: 'Registre, encontre e organize.', banks: 'A identificação dos seus pagamentos.', cards: 'Seu cartão, sem surpresas.', bills: 'Seus próximos compromissos.', thirds: 'Cada valor no seu lugar.', categories: 'Organização que faz sentido.', budgets: 'Planeje antes de gastar.', reports: 'Entenda o que mudou.', settings: 'Seu espaço, do seu jeito.' };
function humanError(err: unknown) {
  if (err instanceof Error) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) return 'Não foi possível conectar. Verifique sua internet e tente novamente; seus campos foram preservados.';
    if (err.message.includes('schema cache') || err.message.includes('does not exist')) return 'A estrutura do banco ainda não está instalada. Execute a migração indicada no README no SQL Editor do Supabase.';
    if (err.message.startsWith('[')) { try { return JSON.parse(err.message).map((i: { message: string }) => i.message).join(' '); } catch { /* keep original */ } }
    return err.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}

export default function App() {
  if (location.pathname === '/instalacao') return <Installation />;
  const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(sessionStorage.getItem('compasso-demo') === 'true');
  const [spaceList, setSpaceList] = useState<S.Space[]>([]); const [spaceId, setSpaceId] = useState(''); const [memberList, setMemberList] = useState<D.Member[]>([]);
  const [snapshot, setSnapshot] = useState<S.Snapshot>({ data: D.emptyState(), revision: 0 }); const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<Page>('dashboard'); const [month, setMonth] = useState(D.currentMonth()); const [modal, setModal] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [toast, setToast] = useState(''); const [remoteChanged, setRemoteChanged] = useState(false); const [mobileMenu, setMobileMenu] = useState(false);
  const [recovery, setRecovery] = useState(location.hash.includes('type=recovery'));
  const close = useCallback(() => setModal(null), []);
  const userId = demo ? S.DEMO_USER : session?.user.id || ''; const me = memberList.find(m => m.userId === userId && m.active); const role = me?.role || 'reader'; const writable = role !== 'reader'; const state = snapshot.data;
  const space = spaceList.find(s => s.id === spaceId) || { id: spaceId, name: 'Meu espaço' };
  const notify = (text: string) => { setToast(text); setTimeout(() => setToast(''), 4500); };

  useEffect(() => {
    S.getSession().then(s => { setSession(s); setReady(true); }).catch(err => { setError(humanError(err)); setReady(true); });
    const auth = S.supabase?.auth.onAuthStateChange((event, s) => { setSession(s); if (event === 'PASSWORD_RECOVERY') setRecovery(true); });
    return () => auth?.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (demo) {
      setSpaceList([{ id: 'demo', name: 'Espaço de exemplo' }]); setSpaceId('demo'); setMemberList([S.demoMember]);
      S.demoLoad().then(async stored => { if (stored) setSnapshot(stored); else { const result = await S.demoSave({ data: D.emptyState(), revision: 0 }, demoData()); setSnapshot(result); } setLoaded(true); }).catch(err => setError(humanError(err)));
      return;
    }
    setLoaded(false); setSpaceList([]); setSpaceId('');
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const invite = new URLSearchParams(location.search).get('invite');
        if (invite) { await S.acceptInvite(invite); history.replaceState({}, '', location.pathname); notify('Convite aceito. Você agora participa do espaço.'); }
        const list = await S.spaces(); if (cancelled) return; setSpaceList(list); setSpaceId(list.find(s => s.id === localStorage.getItem('compasso-space'))?.id || list[0]?.id || '');
      } catch (err) { setError(humanError(err)); }
    })();
    return () => { cancelled = true; };
  }, [session?.user.id, demo]);
  const refresh = useCallback(async () => {
    setError('');
    try {
      if (demo) { const stored = await S.demoLoad(); if (stored) setSnapshot(stored); setMemberList([S.demoMember]); }
      else { const [data, list] = await Promise.all([S.load(spaceId), S.members(spaceId)]); setSnapshot(data); setMemberList(list); }
      setLoaded(true); setRemoteChanged(false);
    } catch (err) { setError(humanError(err)); }
  }, [spaceId, demo]);
  useEffect(() => { if (!spaceId || demo) return; setLoaded(false); refresh(); localStorage.setItem('compasso-space', spaceId); }, [spaceId, demo, refresh]);
  useEffect(() => {
    if (!loaded || !spaceId) return;
    const timer = setInterval(async () => {
      try {
        if (demo) { const stored = await S.demoLoad(); if (stored && stored.revision !== snapshot.revision) setRemoteChanged(true); }
        else { const current = await S.load(spaceId); const members = await S.members(spaceId); setMemberList(members); if (current.revision !== snapshot.revision) setRemoteChanged(true); }
      } catch (err) { setError(humanError(err)); }
    }, 30000);
    return () => clearInterval(timer);
  }, [loaded, spaceId, demo, snapshot.revision]);
  async function commit(next: D.State, restore = false) {
    if (!writable) throw new Error('Seu acesso permite somente consulta.');
    if (busy) throw new Error('Aguarde a gravação anterior.');
    setBusy(true); setError('');
    try {
      const result = demo ? await S.demoSave(snapshot, next) : await S.save(spaceId, snapshot, next, restore);
      setSnapshot(result); setModal(null); setRemoteChanged(false); notify(restore ? 'Backup restaurado.' : 'Dados salvos.');
    } catch (err) { if (humanError(err).includes('CONFLICT') || humanError(err).includes('Outra')) setRemoteChanged(true); throw new Error(humanError(err)); }
    finally { setBusy(false); }
  }
  async function safeCommit(next: D.State) { try { await commit(next); } catch (err) { setError(humanError(err)); } }
  async function create(name: string) {
    if (demo) throw new Error('A criação de espaços está disponível após entrar com seu login.');
    setBusy(true); try { const sid = await S.createSpace(name); setSpaceList(await S.spaces()); setSpaceId(sid); setModal(null); } finally { setBusy(false); }
  }
  async function signOut() { if (demo) { sessionStorage.removeItem('compasso-demo'); setDemo(false); setLoaded(false); } else { await S.supabase!.auth.signOut(); setLoaded(false); } }
  const pageProps: PageProps = { state, members: memberList, month, writable, openEntry: entry => setModal({ type: 'detail', entry }), newEntry: (kind, cardId) => setModal({ type: 'entry', kind, cardId }), editEntity: (collection, entity) => setModal({ type: 'entity', collection, entity }), openPayment: inv => setModal({ type: 'payment', inv }), openReceipt: (entryId, contactId) => setModal({ type: 'receipt', entryId, contactId }), openReturn: (receiptId, entryId, contactId) => setModal({ type: 'return', receiptId, entryId, contactId }), openBudget: budget => setModal({ type: 'budget', budget }), showEntries: (title, entries) => setModal({ type: 'entries', title, entries }), commit: safeCommit };
  const shared = { state, members: memberList, userId, commit, cancel: close, busy };
  let body: ReactNode;
  if (page === 'dashboard') body = <Dashboard {...pageProps} />;
  else if (page === 'transactions' || page === 'bills') body = <Transactions key={page + month + spaceId} {...pageProps} bills={page === 'bills'} />;
  else if (page === 'cards') body = <Cards {...pageProps} />;
  else if (page === 'thirds') body = <Thirds {...pageProps} />;
  else if (page === 'banks' || page === 'categories') body = <Entities key={page} {...pageProps} collection={page} />;
  else if (page === 'budgets') body = <Budgets {...pageProps} />;
  else if (page === 'reports') body = <Reports key={spaceId} {...pageProps} />;
  else body = <SettingsPage demo={demo} space={space} state={state} members={memberList} role={role} busy={busy} commit={commit} refresh={refresh} notify={notify} />;

  if (!ready) return <div className="boot"><LoaderCircle className="spin" /><p>Preparando seu espaço…</p></div>;
  if (recovery && session && !demo) return <AuthScreen recovery onRecovered={() => { setRecovery(false); history.replaceState({}, '', location.pathname); }} onDemo={() => { sessionStorage.setItem('compasso-demo', 'true'); setDemo(true); }} error={error} />;
  if (!session && !demo) return <AuthScreen onDemo={() => { sessionStorage.setItem('compasso-demo', 'true'); setDemo(true); }} error={error} />;
  const groupedAlerts = D.alertGroups(state);
  const monthInvoiceAlerts = D.alertGroups(state, undefined, month).invoices;
  const alerts = [...groupedAlerts.bills, ...groupedAlerts.incomes, ...groupedAlerts.invoices];
  return <div className="app-shell"><aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><div className="brand"><div className="brand-symbol"><span /><span /><span /></div><span>compasso<span className="brand-dot">.</span></span></div><span className="brand-caption">FINANÇAS NO SEU RITMO</span><div className="space-picker"><span className="space-avatar">{space.name.charAt(0).toUpperCase()}</span><div><small>ESPAÇO FINANCEIRO</small><select aria-label="Espaço financeiro" value={spaceId} onChange={e => { setSpaceId(e.target.value); setPage('dashboard'); setModal(null); }}>{spaceList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><ChevronDown size={15} /></div><nav>{NAV.map(([key, label, Icon], i) => <button className={`${page === key ? 'active' : ''} ${i === 6 || i === 9 ? 'nav-break' : ''}`} key={key} onClick={() => { setPage(key); setMobileMenu(false); }}><Icon size={18} /><span>{label}</span>{key === 'bills' && groupedAlerts.bills.length > 0 && <small className="nav-count" title="Contas atrasadas ou a vencer em até 7 dias, de todos os períodos">{groupedAlerts.bills.length}</small>}{key === 'cards' && monthInvoiceAlerts.length > 0 && <small className="nav-count" title="Faturas do mês selecionado atrasadas ou a vencer em até 7 dias">{monthInvoiceAlerts.length}</small>}</button>)}</nav><div className="sidebar-bottom">{!demo && <button className="text-button" onClick={() => setModal({ type: 'space' })}><Plus size={15} />Criar outro espaço</button>}<div className="user-row"><span className="user-avatar">{(me?.name || session?.user.email || 'E').charAt(0).toUpperCase()}</span><span><b>{me?.name || 'Seu perfil'}</b><small>{demo ? 'Modo de exemplo' : ({ admin: 'Administrador', editor: 'Editor', reader: 'Somente leitura' })[role]}</small></span><button className="icon-button" aria-label="Sair" onClick={signOut}><LogOut size={17} /></button></div></div></aside><div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Abrir navegação" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button><span>{space.name}</span><ChevronRight size={13} /><b>{NAV.find(n => n[0] === page)?.[1]}</b></div><div className="topbar-actions"><span className={`connection ${demo ? 'demo' : ''}`}><i />{busy ? 'Salvando…' : demo ? 'Exemplos locais' : 'Supabase conectado'}</span><button className="icon-button notification" aria-label={`Alertas: ${alerts.length}`} onClick={() => setModal({ type: 'alerts' })}><Bell size={19} />{alerts.length > 0 && <i />}</button><button className="icon-button" aria-label="Atualizar dados" onClick={() => { if (modal && !window.confirm('Atualizar e fechar o formulário atual?')) return; setModal(null); refresh(); }}><RefreshCw size={17} /></button></div></header><main><div className="page-heading"><div><span className="eyebrow">{page === 'dashboard' ? 'SEU DINHEIRO, COM CLAREZA' : 'SEU ESPAÇO FINANCEIRO'}</span><h1>{NAV.find(n => n[0] === page)?.[1]}</h1><p>{titles[page]}</p></div><div className="heading-actions"><div className="month-picker"><CalendarClock size={17} /><input type="month" aria-label="Mês de referência" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></div>{writable && <button className="button primary" onClick={() => setModal({ type: 'entry' })}><Plus size={17} />Novo lançamento</button>}</div></div>
    {demo && <div className="demo-banner"><span>Modo de exemplo · dados fictícios salvos apenas neste navegador. Não são enviados ao Supabase.</span><button className="text-button" onClick={signOut}>Entrar com meu login <ArrowRight size={14} /></button></div>}
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" aria-label="Fechar erro" onClick={() => setError('')}><X size={16} /></button></div>}
    {remoteChanged && <div className="warning-banner">Os dados foram alterados em outro acesso. Atualize antes de salvar.<button className="text-button" onClick={() => { if (!modal || window.confirm('Fechar o formulário e carregar a versão atual?')) { setModal(null); refresh(); } }}>Atualizar agora</button></div>}
    {!spaceId ? <Empty title="Crie seu primeiro espaço financeiro" description="Use sozinho ou convide outras pessoas. Você decide como organizar." action={() => setModal({ type: 'space' })} actionLabel="Criar espaço" /> : !loaded ? <div className="loading-panel"><LoaderCircle className="spin" /><span>Carregando dados do espaço…</span>{error && <button className="button" onClick={refresh}>Tentar novamente</button>}</div> : body}
    </main><footer className="app-footer"><span>Compasso · Organização financeira</span><span>{demo ? 'Dados fictícios' : `Última versão salva: ${snapshot.revision}`} · Valores em reais</span></footer></div>
    {toast && <div role="status" className="toast"><CheckCircle2 size={18} />{toast}</div>}
    {modal && <Modal title={modal.type === 'entry' ? modal.entry ? 'Editar lançamento' : 'Novo lançamento' : modal.type === 'entity' ? `${modal.entity ? 'Editar' : 'Adicionar'} ${({ banks: 'banco', cards: 'cartão', categories: 'categoria', contacts: 'pessoa externa' })[modal.collection]}` : modal.type === 'payment' ? 'Pagamento de fatura' : modal.type === 'receipt' ? 'Recebimento de terceiro' : modal.type === 'return' ? 'Devolução a terceiro' : modal.type === 'refund' ? 'Estorno de despesa' : modal.type === 'settle' ? 'Realizar lançamento' : modal.type === 'budget' ? 'Orçamento da categoria' : modal.type === 'entries' ? modal.title : modal.type === 'detail' ? 'Detalhes do lançamento' : modal.type === 'space' ? 'Novo espaço financeiro' : 'Alertas e próximos vencimentos'} close={close} wide={modal.type === 'entry' || modal.type === 'entries'}>
      {modal.type === 'entry' && <EntryForm {...shared} entry={modal.entry} kind={modal.kind} defaultCard={modal.cardId} defaultMonth={month} />}
      {modal.type === 'entity' && <EntityForm {...shared} collection={modal.collection} entity={modal.entity} />}
      {modal.type === 'payment' && <PaymentForm {...shared} inv={D.invoice(state, modal.inv.card.id, modal.inv.month)} />}
      {modal.type === 'receipt' && (D.thirds(state).outstanding > 0 ? <ReceiptForm {...shared} entryId={modal.entryId} contactId={modal.contactId} /> : <ReceiptGuide addContact={() => setModal({ type: 'entity', collection: 'contacts' })} newExpense={() => setModal({ type: 'entry', kind: 'expense' })} existingExpense={() => { setPage('transactions'); setModal(null); }} />)}
      {modal.type === 'return' && <ReturnForm {...shared} receiptId={modal.receiptId} entryId={modal.entryId} contactId={modal.contactId} />}
      {modal.type === 'refund' && <RefundForm {...shared} entry={modal.entry} />}
      {modal.type === 'settle' && <SettleForm {...shared} entry={modal.entry} />}
      {modal.type === 'budget' && <BudgetForm {...shared} month={month} budget={modal.budget} />}
      {modal.type === 'entries' && <div><p className="hint">Valores completos dos registros. Divisões pessoais e de terceiros podem ser consultadas em cada lançamento.</p><EntryTable entries={modal.entries} state={state} members={memberList} onSelect={entry => setModal({ type: 'detail', entry })} /></div>}
      {modal.type === 'space' && <SpaceForm create={create} busy={busy} cancel={close} />}
      {modal.type === 'detail' && <EntryDetail entry={state.entries.find(e => e.id === modal.entry.id) || modal.entry} state={state} members={memberList} writable={writable} edit={() => setModal({ type: 'entry', entry: modal.entry })} settle={() => setModal({ type: 'settle', entry: modal.entry })} refund={() => setModal({ type: 'refund', entry: modal.entry })} remove={async () => { if (!window.confirm(modal.entry.purchaseId ? 'Excluir a compra inteira e todas as suas parcelas? Esta ação será salva no histórico de backup.' : 'Excluir este lançamento? Esta ação será salva no histórico de backup.')) return; try { let next = state; const group = modal.entry.purchaseId ? state.entries.filter(e => e.purchaseId === modal.entry.purchaseId) : [modal.entry]; for (const e of group) next = D.removeEntry(next, e.id); await commit(next); } catch (err) { setError(humanError(err)); } }} />}
      {modal.type === 'alerts' && <div className="simple-list">{alerts.length ? alerts.map((a, i) => 'description' in a ? <button key={i} onClick={() => setModal({ type: 'detail', entry: a })}><span><b>{a.description}</b><small>{a.kind === 'income' ? 'Receita a receber' : 'Conta a pagar'} · {D.dateLabel(a.dueDate || a.date)}</small></span><StatusBadge status={D.effectiveStatus(a)} /><b>{D.money(a.amount)}</b></button> : <button key={i} onClick={() => setModal({ type: 'entries', title: a.card.name, entries: a.entries })}><span><b>Fatura · {a.card.name}</b><small>{D.dateLabel(a.dueDate)}</small></span><b>{D.money(a.remaining)}</b></button>) : <Empty title="Tudo em dia" description="Nenhum vencimento pendente nos próximos sete dias." />}</div>}
    </Modal>}
  </div>;
}

function AuthScreen({ onDemo, error, recovery = false, onRecovered }: { onDemo: () => void; error: string; recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [failure, setFailure] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setFailure(''); setMessage('');
    try {
      if (!S.supabase) throw new Error('Configure a URL e a chave pública do Supabase no arquivo .env.local, conforme o README.');
      const result = recovery ? await S.supabase.auth.updateUser({ password }) : mode === 'login' ? await S.supabase.auth.signInWithPassword({ email, password }) : mode === 'signup' ? await S.supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin } }) : await S.supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (result.error) throw result.error;
      if (recovery) { onRecovered?.(); }
      else if (mode === 'signup') setMessage('Confira seu e-mail para confirmar o cadastro e entrar.');
      else if (mode === 'reset') setMessage('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
    } catch (err) { setFailure(humanError(err)); } finally { setBusy(false); }
  }
  return <div className="auth-shell"><div className="auth-brand"><div className="brand"><div className="brand-symbol"><span /><span /><span /></div><span>compasso.</span></div><h1>Seu dinheiro.<br />Mais clareza.</h1><p>Receitas, despesas, cartões e compromissos.<br />Cada valor no seu lugar.</p><div className="auth-features"><span><CheckCircle2 size={17} />Use sozinho ou compartilhe um espaço</span><span><CheckCircle2 size={17} />Dinheiro de terceiros sempre separado</span><span><ShieldCheck size={17} />Dados protegidos no seu Supabase</span></div></div><div className="auth-content"><div className="auth-card"><span className="eyebrow">BEM-VINDO AO COMPASSO</span><h2>{recovery ? 'Defina sua nova senha' : mode === 'login' ? 'Entre no seu espaço' : mode === 'signup' ? 'Crie seu acesso' : 'Recupere seu acesso'}</h2><p>{recovery ? 'Sua senha é armazenada de forma segura pelo Supabase.' : 'Organize suas finanças do seu jeito.'}</p><form onSubmit={submit}>{mode === 'signup' && !recovery && <Field label="Seu nome"><input required maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></Field>}{!recovery && <Field label="E-mail"><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>}{(mode !== 'reset' || recovery) && <Field label="Senha"><input required type="password" minLength={recovery || mode === 'signup' ? 8 : undefined} autoComplete={mode === 'login' && !recovery ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></Field>}{(failure || error) && <div className="form-error" role="alert">{failure || error}</div>}{message && <div className="success-banner" role="status">{message}</div>}<button className="button primary auth-submit" disabled={busy || !S.supabase}>{busy ? 'Aguarde…' : recovery ? 'Atualizar senha' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar acesso' : 'Enviar instruções'}<ArrowRight size={17} /></button></form>{!recovery && <><div className="auth-links"><button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setFailure(''); setMessage(''); }}>{mode === 'signup' ? 'Já tenho acesso' : 'Criar acesso'}</button><button onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setFailure(''); setMessage(''); }}>{mode === 'reset' ? 'Voltar ao login' : 'Esqueci a senha'}</button></div><div className="auth-divider"><span>ou conheça primeiro</span></div><button className="button auth-submit" onClick={onDemo}>Explorar exemplos fictícios <ArrowRight size={16} /></button><small className="auth-note">Exemplos ficam apenas neste navegador e podem ser removidos.</small></>}{!S.supabase && <p className="info-line">Conexão pendente: configure o Supabase seguindo o README.</p>}</div></div></div>;
}

function Installation() {
  const upgrade = new URLSearchParams(location.search).get('atualizacao') === '2'; const sql = upgrade ? invitationSql : installationSql;
  return <main className="installation"><div className="brand">compasso.</div><h1>{upgrade ? 'Atualização dos convites' : 'Instalação do banco'}</h1><p>Execute este arquivo uma única vez no SQL Editor do seu projeto Supabase. {upgrade ? 'Protege o último administrador e invalida convites quando o acesso é removido.' : 'Cria a estrutura, as validações e o acesso isolado por espaço.'} Não contém dados pessoais nem credenciais.</p><a className="button" href="/">Voltar para a aplicação</a><p><button className="button primary" onClick={() => S.download(upgrade ? '002_convites.sql' : '001_compasso.sql', sql, 'text/plain')}>Baixar arquivo de instalação</button></p><label htmlFor="installation-sql">SQL da instalação</label><textarea id="installation-sql" readOnly value={sql} style={{ width: '100%', height: 480, fontFamily: 'monospace', fontSize: 12 }} /></main>;
}

function SpaceForm({ create, busy, cancel }: { create: (name: string) => Promise<void>; busy: boolean; cancel: () => void }) { const [name, setName] = useState(''); const [error, setError] = useState(''); return <form onSubmit={async e => { e.preventDefault(); try { await create(name.trim()); } catch (err) { setError(humanError(err)); } }}><Field label="Nome do espaço"><input required maxLength={120} placeholder="Ex.: Minhas finanças" value={name} onChange={e => setName(e.target.value)} /></Field><p className="info-line">Comece individualmente. Você poderá convidar quantas pessoas quiser nas configurações.</p>{error && <div className="form-error">{error}</div>}<div className="form-footer"><button className="button" type="button" onClick={cancel}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Criando…' : 'Criar espaço'}</button></div></form>; }

function EntryDetail({ entry, state, members, writable, edit, settle, refund, remove }: { entry: D.Entry; state: D.State; members: D.Member[]; writable: boolean; edit: () => void; settle: () => void; refund: () => void; remove: () => void }) {
  const card = state.cards.find(c => c.id === entry.cardId);
  return <><div className="entry-detail-heading"><span className="eyebrow">{entry.kind === 'income' ? 'RECEITA' : entry.kind === 'refund' ? 'ESTORNO' : 'DESPESA'}</span><h3>{entry.description}</h3><strong>{D.money(entry.amount)}</strong><StatusBadge status={card ? 'Compra no cartão' : D.effectiveStatus(entry)} /></div><div className="details-grid"><div><span>Lançamento / compra</span><b>{D.dateLabel(entry.date)}</b></div><div><span>Competência</span><b>{entry.month.split('-').reverse().join('/')}</b></div><div><span>Vencimento</span><b>{D.dateLabel(entry.dueDate)}</b></div><div><span>Pagamento / recebimento</span><b>{D.dateLabel(entry.paidDate)}</b></div><div><span>Banco / cartão</span><b>{card?.name || state.banks.find(b => b.id === entry.bankId)?.name || 'Não informado'}</b></div><div><span>Forma de pagamento</span><b>{entry.paymentMethod}</b></div>{entry.plannedAmount && <div><span>Valor originalmente previsto</span><b>{D.money(entry.plannedAmount)}</b></div>}{entry.installment && <div><span>Parcela</span><b>{entry.installment} de {entry.installmentCount}</b></div>}</div><h3 className="detail-section">Distribuição do valor</h3><div className="simple-list">{entry.allocations.map((a, i) => <div key={i}><span><b>{state.categories.find(c => c.id === a.categoryId)?.name}</b><small>{a.contactId ? `Terceiro · ${state.contacts.find(c => c.id === a.contactId)?.name}` : a.ownerId ? members.find(m => m.userId === a.ownerId)?.name : 'Compartilhado / pessoal'}</small></span><b>{D.money(a.amount)}</b></div>)}</div>{entry.notes && <p className="notes">{entry.notes}</p>}<p className="hint">Registrado por {members.find(m => m.userId === entry.createdBy)?.name || 'Participante'}.</p>{writable && <div className="form-footer wrap">{entry.kind !== 'refund' && <button className="button" onClick={edit}><Pencil size={15} />Editar{entry.purchaseId ? ' compra inteira' : ''}</button>}{!card && entry.status === 'pending' && <button className="button primary" onClick={settle}>Marcar como {entry.kind === 'income' ? 'recebido' : 'pago'}</button>}{entry.kind === 'expense' && entry.status !== 'cancelled' && <button className="button" onClick={refund}>Estornar</button>}<button className="button danger-outline" onClick={remove}><Trash2 size={15} />Excluir</button></div>}</>;
}

function SettingsPage({ demo, space, state, members, role, busy, commit, refresh, notify }: { demo: boolean; space: S.Space; state: D.State; members: D.Member[]; role: D.Role; busy: boolean; commit: (state: D.State, restore?: boolean) => Promise<void>; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const [email, setEmail] = useState(''); const [inviteRole, setInviteRole] = useState<D.Role>('editor'); const [inviteLink, setInviteLink] = useState(''); const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  async function action(work: () => Promise<void>) { setPending(true); setError(''); try { await work(); } catch (err) { setError(humanError(err)); } finally { setPending(false); } }
  async function restore(file?: File) {
    if (!file) return; if (file.size > 10000000) { setError('O backup excede o limite de 10 MB desta versão.'); return; }
    await action(async () => {
      const parsed = JSON.parse(await file.text()); if (parsed.format !== 'compasso-backup' || parsed.version !== 1) throw new Error('Formato de backup inválido.');
      let data = D.validateState(parsed.data);
      // Historic people from another space cannot gain access through a backup. Explicitly map unknown IDs to shared.
      const known = (id?: string) => !id || members.some(m => m.userId === id);
      const unknown = data.entries.some(e => !known(e.createdBy) || e.allocations.some(a => !known(a.ownerId))) || data.cards.some(c => !known(c.holderId));
      if (unknown) { if (!window.confirm('O backup contém responsáveis de outro espaço. Restaurar como compartilhados, sem conceder acesso a essas pessoas?')) return; const admin = members.find(m => m.role === 'admin' && m.active)!.userId; data = { ...data, entries: data.entries.map(e => ({ ...e, createdBy: known(e.createdBy) ? e.createdBy : admin, allocations: e.allocations.map(a => ({ ...a, ownerId: known(a.ownerId) ? a.ownerId : undefined })) })), cards: data.cards.map(c => ({ ...c, holderId: known(c.holderId) ? c.holderId : undefined })), series: data.series.map(s => ({ ...s, template: { ...s.template, createdBy: known(s.template.createdBy) ? s.template.createdBy : admin, allocations: s.template.allocations.map(a => ({ ...a, ownerId: known(a.ownerId) ? a.ownerId : undefined })) } })) }; }
      if (!window.confirm(`Substituir os dados financeiros de "${space.name}" por este backup? Participantes e permissões permanecerão. Um backup dos dados atuais será baixado antes.`)) return;
      S.backup(state, space); await commit(data, true);
    });
  }
  return <>{error && <div className="form-error" role="alert">{error}</div>}<section className="panel settings-panel"><div className="panel-heading"><div><h3>Participantes do espaço</h3><p>Logins individuais · acesso conforme a função</p></div><span className="count-pill">{members.filter(m => m.active).length} ativos</span></div><div className="simple-list">{members.map(m => <div key={m.userId}><span><b>{m.name}</b><small>{m.email} · {m.active ? 'Ativo' : 'Acesso removido; histórico preservado'}</small></span>{role === 'admin' && !demo ? <div className="inline-actions"><select aria-label={`Permissão de ${m.name}`} value={m.role} disabled={pending} onChange={e => action(async () => { await S.changeMember(space.id, m, e.target.value as D.Role, m.active); await refresh(); })}><option value="admin">Administrador</option><option value="editor">Editor</option><option value="reader">Leitor</option></select><button className="button" disabled={pending} onClick={() => { if (!window.confirm(`${m.active ? 'Revogar' : 'Restaurar'} o acesso de ${m.name}?`)) return; action(async () => { await S.changeMember(space.id, m, m.role, !m.active); await refresh(); }); }}>{m.active ? 'Remover acesso' : 'Reativar'}</button></div> : <StatusBadge status={({ admin: 'Administrador', editor: 'Editor', reader: 'Leitor' })[m.role]} />}</div>)}</div>{role === 'admin' && <form className="invite-form" onSubmit={e => { e.preventDefault(); action(async () => { if (demo) throw new Error('Convites estão disponíveis após entrar com seu login.'); setInviteLink(await S.invite(space.id, email, inviteRole)); }); }}><Field label="Convidar pelo e-mail"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" /></Field><Field label="Permissão"><select value={inviteRole} onChange={e => setInviteRole(e.target.value as D.Role)}><option value="reader">Leitor</option><option value="editor">Editor</option><option value="admin">Administrador</option></select></Field><button className="button primary" disabled={pending || demo}>Gerar convite</button></form>}{inviteLink && <div className="invite-link"><input aria-label="Link do convite" readOnly value={inviteLink} /><button className="button" onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); notify('Link copiado. Válido por sete dias.'); } catch { setError('Selecione e copie o link manualmente.'); } }}><Copy size={15} />Copiar</button><small>Envie o link à pessoa. Nenhum e-mail foi enviado automaticamente.</small></div>}</section>
    <section className="panel settings-panel"><div className="panel-heading"><div><h3>Exportação e backup</h3><p>Dados financeiros do espaço atual, sem senhas ou sessões.</p></div><ShieldCheck size={20} /></div><div className="settings-actions"><button className="button" onClick={() => S.backup(state, space)}><Download size={16} />Baixar backup JSON</button>{role === 'admin' && <label className={`button file-button ${busy ? 'disabled' : ''}`}>Restaurar backup<input type="file" accept="application/json,.json" disabled={busy} onChange={e => { restore(e.target.files?.[0]); e.target.value = ''; }} /></label>}</div><p className="hint">CSV está disponível em Lançamentos e Relatórios e respeita os filtros aplicados. O banco mantém versões anteriores a cada gravação.</p></section>
    <section className="panel settings-panel"><div className="panel-heading"><h3>Regras do seu orçamento</h3></div><div className="rules-list"><p><b>Saldo geral:</b> receitas próprias recebidas menos despesas pessoais por competência, inclusive pendentes. Não representa saldo bancário.</p><p><b>Cartão:</b> cada parcela entra no mês de sua fatura. Pagar a fatura não desconta o orçamento novamente.</p><p><b>Terceiros:</b> valores recebidos ficam separados e são usados apenas nos pagamentos vinculados. Reposições posteriores continuam separadas.</p><p><b>Meses:</b> não há transporte automático de sobras. Orçamentos podem ser copiados para o mês seguinte.</p><p><b>Armazenamento:</b> {demo ? 'IndexedDB exclusivamente para exemplos fictícios neste navegador.' : 'PostgreSQL no Supabase, com acesso autorizado por espaço.'}</p></div></section>
    {demo && role === 'admin' && <section className="panel settings-panel"><div className="panel-heading"><h3>Dados de exemplo</h3></div><div className="settings-actions"><button className="button danger-outline" onClick={() => { if (!window.confirm('Remover todos os exemplos deste navegador?')) return; action(async () => { await commit({ ...D.emptyState(), categories: D.suggestedCategories() }); }); }}>Remover exemplos</button><button className="button" onClick={() => { if (!window.confirm('Substituir os exemplos por um novo conjunto fictício?')) return; action(async () => { await commit(demoData()); }); }}>Recriar exemplos</button></div></section>}
  </>;
}
