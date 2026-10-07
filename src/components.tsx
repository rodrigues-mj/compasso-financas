import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, Plus, Inbox, ChevronRight } from 'lucide-react';
import { money, dateLabel, effectiveStatus, scopedAllocations, entrySelectionTotals, type Entry, type State, type Member, type EntryScope } from './domain';
export type { EntryScope } from './domain';

export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []);
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
      }
    }
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); before?.focus(); };
  }, [close]);
  return <div className="modal-backdrop"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? 'wide' : ''}`}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Fechar"><X size={20} /></button></div>{children}</div></div>;
}
export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) { return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Empty({ title = 'Nada por aqui ainda', description = 'Os registros aparecerão aqui assim que você começar.', action, actionLabel = 'Adicionar' }: { title?: string; description?: string; action?: () => void; actionLabel?: string }) { return <div className="empty"><div className="empty-icon"><Inbox size={27} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="button primary" onClick={action}><Plus size={16} />{actionLabel}</button>}</div>; }
export function StatusBadge({ status }: { status: string }) { const labels: Record<string, string> = { pending: 'Pendente', done: 'Realizado', cancelled: 'Cancelado', overdue: 'Atrasado' }; return <span className={`badge ${status === 'overdue' ? 'danger' : status === 'pending' || status.includes('Parcial') ? 'amber' : status === 'cancelled' ? 'neutral' : 'green'}`}>{labels[status] || status}</span>; }
export function Kpi({ label, amount, detail, icon, tone = '', onClick }: { label: string; amount: number; detail: ReactNode; icon?: ReactNode; tone?: string; onClick?: () => void }) { return <button className={`kpi ${tone}`} onClick={onClick} disabled={!onClick}><div className="kpi-label">{label}{icon || <ArrowUpRight size={17} />}</div><strong>{money(amount)}</strong><div className="kpi-detail">{detail}</div></button>; }
export function SelectionTotals({ items, detail, title = 'Totais da seleção' }: { items: { label: string; amount: number }[]; detail: ReactNode; title?: string }) {
  return <section className="selection-totals" aria-label={title} aria-live="polite"><h3>{title}</h3><div className="selection-total-items">{items.map(item => <div key={item.label}><span>{item.label}</span><strong>{money(item.amount)}</strong></div>)}</div><p>{detail}</p></section>;
}
export function EntryTotals({ state, entries, ...scope }: { state: State; entries: Entry[] } & EntryScope) {
  const totals = entrySelectionTotals(state, entries, scope);
  return <SelectionTotals items={[{ label: 'Receitas da seleção', amount: totals.income }, { label: 'Despesas da seleção', amount: totals.expenses }, { label: 'Estornos da seleção', amount: totals.refunds }, { label: 'Resultado da seleção', amount: totals.net }]} detail={`Receitas + estornos − despesas · inclui pendentes · ${scope.portion === 'personal' ? 'somente parte pessoal' : scope.portion === 'third' ? 'somente parte de terceiros' : 'partes pessoais e de terceiros'} · ${totals.cancelled} cancelado(s) excluído(s) dos totais. Não representa saldo bancário.`} />;
}
export function EntryTable({ entries, state, members, onSelect, footer, portion = 'all', categoryId, responsible, showTotals = false }: { entries: Entry[]; state: State; members: Member[]; onSelect: (entry: Entry) => void; footer?: ReactNode; showTotals?: boolean } & EntryScope) {
  const rows = entries.map(e => {
    const allocations = scopedAllocations(state, e, { portion, categoryId, responsible });
    return { e, allocations, amount: allocations.reduce((s, a) => s + a.amount, 0) };
  }).filter(row => row.amount > 0);
  return <>{showTotals && <EntryTotals state={state} entries={entries} portion={portion} categoryId={categoryId} responsible={responsible} />}{rows.length ? <div className="table-scroll"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Banco / cartão</th><th>Data</th><th>Status</th><th className="right">Valor</th><th><span className="sr-only">Abrir</span></th></tr></thead><tbody>{rows.map(({ e, allocations, amount }) => {
    const category = state.categories.find(c => c.id === allocations[0]?.categoryId); const card = state.cards.find(c => c.id === e.cardId); const bank = state.banks.find(b => b.id === e.bankId);
    const owners = [...new Set(allocations.map(a => a.contactId ? state.contacts.find(c => c.id === a.contactId)?.name : a.ownerId ? members.find(m => m.userId === a.ownerId)?.name : 'Compartilhado'))];
    return <tr key={e.id} onClick={() => onSelect(e)}><td><button className="table-description" onClick={event => { event.stopPropagation(); onSelect(e); }}><span className={`entry-icon ${e.kind}`} style={{ background: `${category?.color || '#356f62'}18`, color: category?.color }}>{e.kind === 'income' ? '↙' : e.kind === 'refund' ? '↩' : '↗'}</span><span><b>{e.description}</b><small>{owners.join(', ')}{e.installment && ` · ${e.installment} de ${e.installmentCount}`}</small></span></button></td><td><span className="category-label"><i style={{ background: category?.color }} />{allocations.length > 1 ? `${category?.name} + ${allocations.length - 1}` : category?.name}</span></td><td>{card?.name || bank?.name || 'Dinheiro / não informado'}</td><td>{dateLabel(e.date)}</td><td><StatusBadge status={e.cardId ? 'Compra no cartão' : effectiveStatus(e)} /></td><td className={`right amount ${e.kind === 'income' || e.kind === 'refund' ? 'positive' : ''}`}>{e.kind === 'income' || e.kind === 'refund' ? '+' : '−'} {money(amount)}</td><td><ChevronRight size={16} /></td></tr>;
  })}</tbody></table>{footer}</div> : <Empty title="Nenhum lançamento encontrado" description="Adicione um lançamento ou ajuste os filtros selecionados." />}</>;
}
export function Progress({ used, total }: { used: number; total: number }) { const percent = total ? used / total * 100 : 0; return <div className="progress"><div className={percent > 100 ? 'over' : percent >= 80 ? 'warning' : ''} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div>; }
