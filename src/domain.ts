import { z } from 'zod';

export type Role = 'admin' | 'editor' | 'reader';
export type Status = 'pending' | 'done' | 'cancelled';
export type Entity = { id: string; name: string; color: string; archived: boolean };
export type Category = Entity & { kind: 'income' | 'expense'; parentId?: string };
export type Card = Entity & { bankId?: string; holderId?: string; limit: number; closingDay: number; dueDay: number; last4?: string };
export type Allocation = { categoryId: string; amount: number; ownerId?: string; contactId?: string };
export type Entry = {
  id: string; kind: 'income' | 'expense' | 'refund'; description: string; amount: number; plannedAmount?: number;
  date: string; month: string; dueDate?: string; paidDate?: string; status: Status;
  bankId?: string; cardId?: string; paymentMethod: string; notes: string; allocations: Allocation[];
  purchaseId?: string; installment?: number; installmentCount?: number; seriesId?: string; originalId?: string;
  purchaseOriginal?: { amount: number; allocations: Allocation[] };
  createdBy: string; updatedAt: string;
};
export type ReceiptAllocation = { entryId: string; contactId: string; amount: number; replacement: boolean };
export type Receipt = { id: string; date: string; bankId?: string; amount: number; notes: string; allocations: ReceiptAllocation[] };
export type Usage = { receiptId: string; entryId: string; contactId: string; amount: number };
export type Payment = { id: string; cardId: string; month: string; date: string; bankId?: string; amount: number; uses: Usage[] };
export type Return = { id: string; receiptId: string; entryId: string; contactId: string; amount: number; date: string; bankId?: string };
export type Series = { id: string; template: Entry; frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; start: string; end?: string; generatedUntil: string; archived: boolean };
export type Budget = { id: string; month: string; categoryId: string; amount: number };
export type State = { version: 1; banks: Entity[]; categories: Category[]; cards: Card[]; contacts: Entity[]; entries: Entry[]; receipts: Receipt[]; payments: Payment[]; returns: Return[]; series: Series[]; budgets: Budget[] };
export type Member = { userId: string; name: string; email: string; role: Role; active: boolean };
export const emptyState = (): State => ({ version: 1, banks: [], categories: [], cards: [], contacts: [], entries: [], receipts: [], payments: [], returns: [], series: [], budgets: [] });
export const id = () => crypto.randomUUID();
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export const currentMonth = () => today().slice(0, 7);
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const dateLabel = (date?: string) => date ? date.slice(0, 10).split('-').reverse().join('/') : '—';
export function cents(value: string): number {
  const text = value.trim().replace(/R\$\s?/g, '').replace(/\s/g, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Informe um valor positivo com até duas casas decimais.');
  const [whole, decimal = ''] = normalized.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 100000000000) throw new Error('O valor deve ser maior que zero e menor ou igual a R$ 1 bilhão.');
  return result;
}
export function addMonths(month: string, amount: number): string {
  const [year, m] = month.split('-').map(Number); const d = new Date(Date.UTC(year, m - 1 + amount, 1));
  return d.toISOString().slice(0, 7);
}
export function monthDate(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(last, day)).padStart(2, '0')}`;
}
export function shiftDays(date: string, days: number) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function suggestInvoice(card: Card, date: string): string {
  const purchaseMonth = date.slice(0, 7);
  const closingMonth = date >= monthDate(purchaseMonth, card.closingDay) ? addMonths(purchaseMonth, 1) : purchaseMonth;
  return card.dueDay <= card.closingDay ? addMonths(closingMonth, 1) : closingMonth;
}
export function closingDate(card: Card, invoiceMonth: string) { return monthDate(card.dueDay <= card.closingDay ? addMonths(invoiceMonth, -1) : invoiceMonth, card.closingDay); }
export function suggestRegistrationInvoice(card: Card, date: string, selectedMonth: string, minimumMonth = currentMonth()): string {
  return [suggestInvoice(card, date), selectedMonth, minimumMonth].sort().at(-1)!;
}
export function splitCents(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 120 || total < count) throw new Error('Informe de 1 a 120 parcelas, com pelo menos um centavo em cada.');
  return Array.from({ length: count }, (_, index) => Math.floor(total / count) + (index < total % count ? 1 : 0));
}
// Integer proportional allocation; deterministic remainder distribution preserves the sum.
export function proportional(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0); if (sum === 0) return weights.map(() => 0);
  const base = weights.map(w => Number(BigInt(total) * BigInt(w) / BigInt(sum)));
  const order = weights.map((w, i) => ({ i, remainder: BigInt(total) * BigInt(w) % BigInt(sum) })).sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  for (let remaining = total - base.reduce((a, b) => a + b, 0), i = 0; remaining > 0; remaining--, i++) base[order[i % order.length].i]++;
  return base;
}
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v, 'Data inválida.');
const amountSchema = z.number().int().min(1).max(100000000000);
const entitySchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), archived: z.boolean() });
const allocationSchema = z.object({ categoryId: z.string().uuid(), amount: amountSchema, ownerId: z.string().uuid().optional(), contactId: z.string().uuid().optional() }).refine(a => !(a.ownerId && a.contactId), 'Uma divisão não pode ser pessoal e de terceiro ao mesmo tempo.');
const entrySchema = z.object({
  id: z.string().uuid(), kind: z.enum(['income', 'expense', 'refund']), description: z.string().trim().min(1).max(300), amount: amountSchema, plannedAmount: amountSchema.optional(),
  date: dateSchema, month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), dueDate: dateSchema.optional(), paidDate: dateSchema.optional(), status: z.enum(['pending', 'done', 'cancelled']),
  bankId: z.string().uuid().optional(), cardId: z.string().uuid().optional(), paymentMethod: z.string().max(100), notes: z.string().max(2000), allocations: z.array(allocationSchema).min(1).max(100),
  purchaseOriginal: z.object({ amount: amountSchema, allocations: z.array(allocationSchema).min(1).max(100) }).refine(p => p.allocations.reduce((sum, a) => sum + a.amount, 0) === p.amount, 'As divisões originais devem somar o total original.').optional(),
  purchaseId: z.string().uuid().optional(), installment: z.number().int().min(1).optional(), installmentCount: z.number().int().min(1).max(120).optional(), seriesId: z.string().uuid().optional(), originalId: z.string().uuid().optional(), createdBy: z.string().uuid(), updatedAt: z.string()
}).refine(e => e.allocations.reduce((sum, a) => sum + a.amount, 0) === e.amount, 'A soma das divisões deve ser igual ao total.')
  .refine(e => e.cardId || e.status !== 'done' || !!e.paidDate, 'Informe a data do pagamento ou recebimento.')
  .refine(e => e.kind !== 'income' || (!e.cardId && !e.allocations.some(a => a.contactId)), 'Receitas próprias não podem ser compras no cartão ou reembolsos.');
const usageSchema = z.object({ receiptId: z.string().uuid(), entryId: z.string().uuid(), contactId: z.string().uuid(), amount: amountSchema });
export const stateSchema = z.object({
  version: z.literal(1), banks: z.array(entitySchema), contacts: z.array(entitySchema),
  categories: z.array(entitySchema.extend({ kind: z.enum(['income', 'expense']), parentId: z.string().uuid().optional() })),
  cards: z.array(entitySchema.extend({ bankId: z.string().uuid().optional(), holderId: z.string().uuid().optional(), limit: amountSchema, closingDay: z.number().int().min(1).max(31), dueDay: z.number().int().min(1).max(31), last4: z.string().regex(/^\d{4}$/).optional() })),
  entries: z.array(entrySchema),
  receipts: z.array(z.object({ id: z.string().uuid(), date: dateSchema, bankId: z.string().uuid().optional(), amount: amountSchema, notes: z.string().max(2000), allocations: z.array(z.object({ entryId: z.string().uuid(), contactId: z.string().uuid(), amount: amountSchema, replacement: z.boolean() })).min(1) }).refine(r => r.allocations.reduce((s, a) => s + a.amount, 0) === r.amount)),
  payments: z.array(z.object({ id: z.string().uuid(), cardId: z.string().uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), date: dateSchema, bankId: z.string().uuid().optional(), amount: amountSchema, uses: z.array(usageSchema) })),
  returns: z.array(usageSchema.omit({ receiptId: true }).extend({ id: z.string().uuid(), receiptId: z.string().uuid(), date: dateSchema, bankId: z.string().uuid().optional() })),
  series: z.array(z.object({ id: z.string().uuid(), template: entrySchema, frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']), start: dateSchema, end: dateSchema.optional(), generatedUntil: dateSchema, archived: z.boolean() })),
  budgets: z.array(z.object({ id: z.string().uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), categoryId: z.string().uuid(), amount: amountSchema }))
});
export const personalAmount = (e: Entry) => e.allocations.filter(a => !a.contactId).reduce((sum, a) => sum + a.amount, 0);
export const thirdAmount = (e: Entry) => e.amount - personalAmount(e);
export const effectiveStatus = (e: Entry, date = today()) => e.status === 'pending' && e.dueDate && e.dueDate < date ? 'overdue' : e.status;
export function alertGroups(state: State, date = today(), invoiceMonth?: string) {
  const upcoming = state.entries.filter(e => !e.cardId && e.status === 'pending' && (e.dueDate || e.date) <= shiftDays(date, 7));
  return {
    bills: upcoming.filter(e => e.kind === 'expense'),
    incomes: upcoming.filter(e => e.kind === 'income'),
    invoices: invoices(state).filter(i => (!invoiceMonth || i.month === invoiceMonth) && i.remaining > 0 && i.dueDate <= shiftDays(date, 7))
  };
}
export function thirdDebt(state: State, entryId: string, contactId: string): number {
  const e = state.entries.find(e => e.id === entryId); if (!e || e.status === 'cancelled') return 0;
  const original = e.allocations.filter(a => a.contactId === contactId).reduce((s, a) => s + a.amount, 0);
  const refunded = state.entries.filter(r => r.originalId === entryId && r.status !== 'cancelled').flatMap(r => r.allocations).filter(a => a.contactId === contactId).reduce((s, a) => s + a.amount, 0);
  return original - refunded;
}
export function receivedFor(state: State, entryId: string, contactId: string) {
  return state.receipts.flatMap(r => r.allocations).filter(a => a.entryId === entryId && a.contactId === contactId).reduce((s, a) => s + a.amount, 0)
    - state.returns.filter(r => r.entryId === entryId && r.contactId === contactId).reduce((s, r) => s + r.amount, 0);
}
export function usedFrom(state: State, receiptId: string, entryId?: string, contactId?: string) {
  return state.payments.flatMap(p => p.uses).filter(u => u.receiptId === receiptId && (!entryId || u.entryId === entryId) && (!contactId || u.contactId === contactId)).reduce((s, u) => s + u.amount, 0);
}
export function availableReceipt(state: State, receipt: Receipt, a: ReceiptAllocation) {
  return a.amount - usedFrom(state, receipt.id, a.entryId, a.contactId) - state.returns.filter(r => r.receiptId === receipt.id && r.entryId === a.entryId && r.contactId === a.contactId).reduce((s, r) => s + r.amount, 0);
}
export function thirdUnusedDebt(state: State, entryId: string, contactId: string) {
  const used = state.payments.flatMap(p => p.uses).filter(u => u.entryId === entryId && u.contactId === contactId).reduce((s, u) => s + u.amount, 0);
  return Math.max(0, thirdDebt(state, entryId, contactId) - used);
}
export function thirds(state: State) {
  const lines = state.entries.filter(e => e.kind === 'expense' && e.status !== 'cancelled').flatMap(e => [...new Set(e.allocations.flatMap(a => a.contactId ? [a.contactId] : []))].map(contactId => ({ entry: e, contactId, debt: thirdDebt(state, e.id, contactId), received: receivedFor(state, e.id, contactId) })));
  const available = state.receipts.reduce((s, r) => s + r.allocations.reduce((t, a) => t + availableReceipt(state, r, a), 0), 0);
  return { lines, outstanding: lines.reduce((s, l) => s + Math.max(0, l.debt - l.received), 0), balance: available, returnable: lines.reduce((s, l) => s + Math.max(0, l.received - l.debt), 0) };
}
export type Invoice = { card: Card; month: string; dueDate: string; entries: Entry[]; total: number; paid: number; remaining: number; thirdAvailable: number; personal: number; third: number; status: string };
export function invoice(state: State, cardId: string, month: string): Invoice {
  const card = state.cards.find(c => c.id === cardId); if (!card) throw new Error('Cartão não encontrado.');
  const entries = state.entries.filter(e => e.cardId === cardId && e.month === month && e.status !== 'cancelled');
  const total = entries.reduce((s, e) => s + (e.kind === 'refund' ? -e.amount : e.amount), 0);
  const paid = state.payments.filter(p => p.cardId === cardId && p.month === month).reduce((s, p) => s + p.amount, 0);
  // An invoice credit is applied chronologically to the next invoice, never counted as income.
  const months = [...new Set(state.entries.filter(e => e.cardId === cardId && e.status !== 'cancelled' && e.month < month).map(e => e.month))].sort();
  let credit = 0;
  for (const m of months) {
    const subtotal = state.entries.filter(e => e.cardId === cardId && e.month === m && e.status !== 'cancelled').reduce((s, e) => s + (e.kind === 'refund' ? -e.amount : e.amount), 0);
    const payments = state.payments.filter(p => p.cardId === cardId && p.month === m).reduce((s, p) => s + p.amount, 0);
    credit = Math.max(0, credit + payments - subtotal);
  }
  const remaining = Math.max(0, total - credit - paid);
  let thirdAvailable = 0; const allocated = new Map<string, number>();
  for (const r of state.receipts) for (const a of r.allocations) {
    if (entries.some(e => e.id === a.entryId) && !a.replacement) {
      const key = `${a.entryId}|${a.contactId}`;
      const amount = Math.min(availableReceipt(state, r, a), Math.max(0, thirdUnusedDebt(state, a.entryId, a.contactId) - (allocated.get(key) || 0)));
      thirdAvailable += amount; allocated.set(key, (allocated.get(key) || 0) + amount);
    }
  }
  const personal = entries.reduce((s, e) => s + (e.kind === 'refund' ? -1 : 1) * personalAmount(e), 0);
  return { card, month, dueDate: monthDate(month, card.dueDay), entries, total: Math.max(0, total - credit), paid, remaining, thirdAvailable: Math.min(thirdAvailable, remaining), personal, third: total - personal,
    status: remaining === 0 && (paid > 0 || entries.length > 0) ? 'Paga' : paid > 0 ? 'Parcialmente paga' : today() >= closingDate(card, month) ? 'Fechada' : 'Aberta' };
}
export function invoices(state: State) { return [...new Set(state.entries.filter(e => e.cardId).map(e => `${e.cardId}|${e.month}`))].map(key => { const [card, month] = key.split('|'); return invoice(state, card, month); }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)); }

export function validateState(input: unknown): State {
  const state = stateSchema.parse(input) as State;
  const collections: { id: string }[][] = [state.banks, state.categories, state.cards, state.contacts, state.entries, state.receipts, state.payments, state.returns, state.series, state.budgets];
  for (const collection of collections) if (new Set(collection.map(e => e.id)).size !== collection.length) throw new Error('Identificadores duplicados.');
  const exists = (collection: { id: string }[], key?: string) => !key || collection.some(x => x.id === key);
  for (const c of state.categories) { if (!exists(state.categories, c.parentId) || c.parentId === c.id) throw new Error('Categoria principal inválida.'); if (c.parentId && (state.categories.find(x => x.id === c.parentId)?.parentId || state.categories.find(x => x.id === c.parentId)?.kind !== c.kind)) throw new Error('A subcategoria deve ter o mesmo tipo da categoria principal. Use apenas dois níveis.'); }
  for (const c of state.cards) if (!exists(state.banks, c.bankId)) throw new Error('Banco do cartão não encontrado.');
  const occurrences = new Set<string>();
  for (const e of state.entries) {
    if (!exists(state.banks, e.bankId) || !exists(state.cards, e.cardId) || !exists(state.series, e.seriesId)) throw new Error('Banco, cartão ou recorrência não encontrado.');
    for (const a of e.allocations) {
      const category = state.categories.find(c => c.id === a.categoryId);
      if (!category || category.kind !== (e.kind === 'income' ? 'income' : 'expense') || !exists(state.contacts, a.contactId)) throw new Error('Categoria ou terceiro inválido.');
    }
    if (e.seriesId) { const key = `${e.seriesId}|${e.date}`; if (occurrences.has(key)) throw new Error('Ocorrência recorrente duplicada.'); occurrences.add(key); }
    if (e.originalId && (!state.entries.some(x => x.id === e.originalId && x.kind === 'expense') || e.kind !== 'refund')) throw new Error('Compra do estorno inválida.');
  }
  for (const e of state.entries.filter(e => e.kind === 'expense')) {
    const refunds = state.entries.filter(r => r.originalId === e.id && r.status !== 'cancelled');
    if (refunds.reduce((s, r) => s + r.amount, 0) > e.amount) throw new Error('O estorno supera o valor da compra.');
    for (const a of e.allocations) {
      const key = (x: Allocation) => `${x.categoryId}|${x.contactId || ''}|${x.ownerId || ''}`;
      const amount = e.allocations.filter(x => key(x) === key(a)).reduce((s, x) => s + x.amount, 0);
      if (refunds.flatMap(r => r.allocations).filter(x => key(x) === key(a)).reduce((s, x) => s + x.amount, 0) > amount) throw new Error('Estorno excede a divisão original.');
    }
  }
  for (const r of state.receipts) {
    if (!exists(state.banks, r.bankId)) throw new Error('Banco do recebimento inválido.');
    const keys = r.allocations.map(a => `${a.entryId}|${a.contactId}`); if (new Set(keys).size !== keys.length) throw new Error('Unifique as divisões para a mesma compra e pessoa.');
    for (const a of r.allocations) {
      const original = state.entries.find(e => e.id === a.entryId);
      if (!original?.allocations.some(x => x.contactId === a.contactId)) throw new Error('Recebimento sem compra do terceiro.');
      if (availableReceipt(state, r, a) < 0) throw new Error('O saldo de terceiros utilizado supera o recebido.');
    }
  }
  for (const p of state.payments) {
    if (!exists(state.cards, p.cardId) || !exists(state.banks, p.bankId)) throw new Error('Cartão ou banco do pagamento inválido.');
    if (p.uses.reduce((s, u) => s + u.amount, 0) > p.amount) throw new Error('Recursos de terceiros superam o pagamento.');
    for (const u of p.uses) {
      const receipt = state.receipts.find(r => r.id === u.receiptId); const e = state.entries.find(e => e.id === u.entryId);
      if (!receipt?.allocations.some(a => a.entryId === u.entryId && a.contactId === u.contactId && !a.replacement) || e?.cardId !== p.cardId || e?.month !== p.month || receipt.date > p.date) throw new Error('Saldo de terceiros não pertence a esta fatura ou data.');
    }
  }
  for (const inv of invoices(state)) {
    const paidBeforeLast = state.payments.filter(p => p.cardId === inv.card.id && p.month === inv.month).reduce((s, p) => s + p.amount, 0);
    // Refunds after payment legitimately create credit; prevent overpayments when submitting the payment operation below.
    if (paidBeforeLast < 0) throw new Error('Pagamento inválido.');
  }
  for (const r of state.returns) if (!state.receipts.some(x => x.id === r.receiptId && x.allocations.some(a => a.entryId === r.entryId && a.contactId === r.contactId))) throw new Error('Devolução sem recebimento relacionado.');
  const budgetKeys = state.budgets.map(b => `${b.month}|${b.categoryId}`); if (new Set(budgetKeys).size !== budgetKeys.length) throw new Error('Orçamento duplicado.');
  for (const b of state.budgets) if (!state.categories.some(c => c.id === b.categoryId && c.kind === 'expense' && !c.parentId)) throw new Error('Defina o orçamento na categoria principal de despesa.');
  return state;
}

export function purchaseSchedule(total: number, count: number, firstMonth: string, startInstallment = 1, originalTotal = true) {
  if (!Number.isInteger(count) || count < 1 || count > 120 || !Number.isInteger(startInstallment) || startInstallment < 1 || startInstallment > count) throw new Error('A parcela inicial deve estar entre 1 e o número total de parcelas.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(firstMonth)) throw new Error('Informe a fatura da parcela inicial.');
  amountSchema.parse(total);
  const parts = originalTotal ? splitCents(total, count).slice(startInstallment - 1) : splitCents(total, count - startInstallment + 1);
  return parts.map((amount, index) => ({ installment: startInstallment + index, amount, month: addMonths(firstMonth, index) }));
}

export function createPurchaseFromOriginal(state: State, template: Entry, count: number, firstMonth: string, startInstallment = 1): State {
  purchaseSchedule(template.amount, count, firstMonth, startInstallment);
  // Distribute the complete purchase before omitting earlier installments, including category rounding.
  const full = createPurchase(state, { ...template, purchaseOriginal: undefined }, count, firstMonth);
  const newIds = new Set(full.entries.slice(state.entries.length).map(e => e.id));
  const entries = full.entries.filter(e => !newIds.has(e.id) || e.installment! >= startInstallment).map(e => newIds.has(e.id) ? {
    ...e, month: addMonths(firstMonth, e.installment! - startInstallment),
    dueDate: monthDate(addMonths(firstMonth, e.installment! - startInstallment), state.cards.find(c => c.id === template.cardId)!.dueDay),
    purchaseOriginal: { amount: template.amount, allocations: template.allocations.map(a => ({ ...a })) }
  } : e);
  return validateState({ ...full, entries });
}

export function createPurchase(state: State, template: Entry, count: number, firstMonth: string, startInstallment = 1): State {
  const schedule = purchaseSchedule(template.amount, count, firstMonth, startInstallment, false);
  if (template.allocations.reduce((s, a) => s + a.amount, 0) !== template.amount) throw new Error('A soma das divisões deve ser exatamente igual ao valor total da compra.');
  entrySchema.parse(template);
  const card = state.cards.find(c => c.id === template.cardId); if (!card || card.archived) throw new Error('Escolha um cartão ativo.');
  // The template contains only the amount and allocations still to be recorded.
  const purchaseId = id(); let remaining = template.allocations.map(a => a.amount);
  const entries = schedule.map(({ amount, month, installment }) => {
    const allocated = proportional(amount, remaining); remaining = remaining.map((n, i) => n - allocated[i]);
    return { ...template, purchaseOriginal: undefined, id: id(), purchaseId, installment, installmentCount: count, amount, month, dueDate: monthDate(month, card.dueDay), status: 'done' as Status, paidDate: undefined,
      allocations: template.allocations.map((a, i) => ({ ...a, amount: allocated[i] })).filter(a => a.amount > 0) };
  });
  return validateState({ ...state, entries: [...state.entries, ...entries] });
}
export function addReceipt(state: State, receipt: Receipt): State {
  if (state.receipts.some(r => r.id === receipt.id)) return state;
  for (const a of receipt.allocations) if (a.amount > Math.max(0, thirdDebt(state, a.entryId, a.contactId) - receivedFor(state, a.entryId, a.contactId))) throw new Error('O recebimento supera o valor a receber.');
  return validateState({ ...state, receipts: [...state.receipts, receipt] });
}
export function payInvoice(state: State, payment: Omit<Payment, 'uses'>, thirdUse: number): State {
  if (state.payments.some(p => p.id === payment.id)) return state;
  const inv = invoice(state, payment.cardId, payment.month);
  if (payment.amount > inv.remaining) throw new Error('O pagamento supera o valor restante da fatura.');
  if (thirdUse < 0 || thirdUse > payment.amount || thirdUse > inv.thirdAvailable) throw new Error('Saldo de terceiros insuficiente para este pagamento.');
  const uses: Usage[] = []; let remaining = thirdUse;
  for (const receipt of state.receipts) for (const a of receipt.allocations) {
    if (a.replacement || !inv.entries.some(e => e.id === a.entryId) || receipt.date > payment.date) continue;
    const committed = uses.filter(u => u.entryId === a.entryId && u.contactId === a.contactId).reduce((s, u) => s + u.amount, 0);
    const amount = Math.min(remaining, availableReceipt(state, receipt, a), Math.max(0, thirdUnusedDebt(state, a.entryId, a.contactId) - committed));
    if (amount > 0) { uses.push({ receiptId: receipt.id, entryId: a.entryId, contactId: a.contactId, amount }); remaining -= amount; }
  }
  if (remaining > 0) throw new Error('O saldo não estava disponível na data do pagamento.');
  return validateState({ ...state, payments: [...state.payments, { ...payment, uses }] });
}
export function refundEntry(state: State, entryId: string, amount: number, date: string, month: string, userId: string) {
  const e = state.entries.find(x => x.id === entryId); if (!e || e.kind !== 'expense' || e.status === 'cancelled') throw new Error('Escolha uma despesa válida.');
  const refunds = state.entries.filter(r => r.originalId === e.id && r.status !== 'cancelled');
  const remaining = e.allocations.map(a => a.amount - refunds.flatMap(r => r.allocations).filter(x => x.categoryId === a.categoryId && x.contactId === a.contactId && x.ownerId === a.ownerId).reduce((s, x) => s + x.amount, 0));
  if (amount > remaining.reduce((s, n) => s + n, 0)) throw new Error('O estorno supera o valor ainda não estornado.');
  const values = proportional(amount, remaining);
  const refund: Entry = { ...e, id: id(), kind: 'refund', amount, date, month, dueDate: undefined, paidDate: date, status: 'done', description: `Estorno · ${e.description}`, originalId: e.id, purchaseId: undefined, seriesId: undefined, installment: undefined, installmentCount: undefined, createdBy: userId, updatedAt: new Date().toISOString(), allocations: e.allocations.map((a, i) => ({ ...a, amount: values[i] })).filter(a => a.amount > 0) };
  return validateState({ ...state, entries: [...state.entries, refund] });
}
export function removeEntry(state: State, entryId: string): State {
  const e = state.entries.find(e => e.id === entryId); if (!e) return state;
  if (state.receipts.some(r => r.allocations.some(a => a.entryId === entryId)) || state.entries.some(r => r.originalId === entryId) || (e.cardId && state.payments.some(p => p.cardId === e.cardId && p.month === e.month))) throw new Error('Este lançamento possui recebimentos, estornos ou fatura paga. Desfaça os vínculos antes de excluí-lo.');
  return validateState({ ...state, entries: state.entries.filter(e => e.id !== entryId) });
}
export function occurrenceDate(start: string, frequency: Series['frequency'], index: number): string {
  if (frequency === 'daily' || frequency === 'weekly') return shiftDays(start, index * (frequency === 'weekly' ? 7 : 1));
  return monthDate(addMonths(start.slice(0, 7), index * (frequency === 'yearly' ? 12 : 1)), Number(start.slice(8)));
}
export function generateSeries(state: State, series: Series, until: string): State {
  if (series.archived) return state;
  const entries = [...state.entries]; const end = series.end && series.end < until ? series.end : until;
  for (let i = 0; i < 10000; i++) {
    const date = occurrenceDate(series.start, series.frequency, i); if (date > end) break;
    if (!entries.some(e => e.seriesId === series.id && e.date === date)) entries.push({ ...series.template, id: id(), date, month: date.slice(0, 7), dueDate: date, paidDate: undefined, status: 'pending', seriesId: series.id });
  }
  const seriesList = [...state.series.filter(s => s.id !== series.id), { ...series, generatedUntil: until }];
  return validateState({ ...state, entries, series: seriesList });
}
export function editSeries(state: State, entry: Entry, scope: 'one' | 'future' | 'all'): State {
  if (!entry.seriesId || scope === 'one') return validateState({ ...state, entries: state.entries.map(e => e.id === entry.id ? entry : e) });
  const series = state.series.find(s => s.id === entry.seriesId)!;
  // Preserve dates and actual payments; apply editable fields only to unpaid occurrences in the selected scope.
  const update = (e: Entry) => ({ ...e, description: entry.description, amount: entry.amount, bankId: entry.bankId, paymentMethod: entry.paymentMethod, notes: entry.notes, allocations: entry.allocations, updatedAt: entry.updatedAt });
  return validateState({ ...state, series: state.series.map(s => s.id === series.id ? { ...s, template: update(s.template) } : s), entries: state.entries.map(e => e.seriesId === series.id && e.status === 'pending' && (scope === 'all' || e.date >= entry.date) ? update(e) : e.id === entry.id ? entry : e) });
}
export function categoryRoot(state: State, categoryId: string) { return state.categories.find(c => c.id === categoryId)?.parentId || categoryId; }
export function monthly(state: State, month: string, cutoff?: number) {
  const inPeriod = (date: string) => date.slice(0, 7) === month && (!cutoff || Number(date.slice(8, 10)) <= cutoff);
  const expenses = state.entries.filter(e => e.kind !== 'income' && e.status !== 'cancelled' && e.month === month && (!cutoff || Number((e.cardId ? e.dueDate || e.date : e.date).slice(8, 10)) <= cutoff));
  const income = state.entries.filter(e => e.kind === 'income' && e.status === 'done' && inPeriod(e.paidDate!)).reduce((s, e) => s + e.amount, 0);
  const projected = state.entries.filter(e => e.kind === 'income' && e.status === 'pending' && e.month === month && (!cutoff || Number(e.date.slice(8, 10)) <= cutoff)).reduce((s, e) => s + e.amount, 0);
  const spent = expenses.reduce((s, e) => s + (e.kind === 'refund' ? -1 : 1) * personalAmount(e), 0);
  const categoryTotals = new Map<string, number>();
  for (const e of expenses) for (const a of e.allocations.filter(a => !a.contactId)) { const root = categoryRoot(state, a.categoryId); categoryTotals.set(root, (categoryTotals.get(root) || 0) + a.amount * (e.kind === 'refund' ? -1 : 1)); }
  return { income, projected, spent, balance: income - spent, projectedBalance: income + projected - spent, expenses, categoryTotals };
}
export type ReportRow = { id: string; description: string; date: string; kind: 'income' | 'expense' | 'third-in' | 'third-out'; amount: number; categoryId?: string; bankId?: string; cardId?: string; entryId?: string; recurring: boolean; status?: Status };
export function reportRows(state: State, perspective: 'consumption' | 'cash', includeThird = false): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const e of state.entries.filter(e => e.status !== 'cancelled')) {
    if (perspective === 'cash' && (e.cardId || e.status !== 'done')) continue;
    const date = perspective === 'cash' ? e.paidDate! : e.kind === 'income' ? e.date : e.cardId ? monthDate(e.month, Number((e.dueDate || e.date).slice(8))) : e.date;
    for (const [i, a] of e.allocations.entries()) {
      if (a.contactId && !includeThird) continue;
      const cashThirdRefund = perspective === 'cash' && a.contactId && e.kind === 'refund';
      rows.push({ id: `${e.id}-${i}`, description: e.description, date, kind: a.contactId ? (cashThirdRefund ? 'third-in' : 'third-out') : e.kind === 'income' ? 'income' : 'expense', amount: a.amount * (e.kind === 'refund' && !cashThirdRefund ? -1 : 1), categoryId: a.categoryId, bankId: e.bankId, cardId: e.cardId, entryId: e.id, recurring: !!e.seriesId, status: e.status });
    }
  }
  if (perspective === 'cash') {
    for (const p of state.payments) {
      const third = p.uses.reduce((s, u) => s + u.amount, 0);
      rows.push({ id: p.id, description: `Pagamento · ${state.cards.find(c => c.id === p.cardId)?.name}`, date: p.date, kind: 'expense', amount: p.amount - third, cardId: p.cardId, bankId: p.bankId, recurring: false });
      if (includeThird && third > 0) rows.push({ id: p.id + '-third', description: 'Pagamento com saldo de terceiros', date: p.date, kind: 'third-out', amount: third, cardId: p.cardId, bankId: p.bankId, recurring: false });
    }
    if (includeThird) {
      for (const r of state.receipts) rows.push({ id: r.id, description: 'Recebimento de terceiros', date: r.date, kind: 'third-in', amount: r.amount, bankId: r.bankId, recurring: false });
      for (const r of state.returns) rows.push({ id: r.id, description: 'Devolução para terceiro', date: r.date, kind: 'third-out', amount: r.amount, bankId: r.bankId, recurring: false });
    }
  }
  return rows;
}
export function variation(before: number, after: number) { return before === 0 ? null : (after - before) / Math.abs(before) * 100; }
export function csv(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(v => { const text = typeof v === 'number' ? (v / 100).toFixed(2).replace('.', ',') : /^[\s]*[=+\-@\t\r]/.test(v) ? "'" + v : v; return '"' + text.replace(/"/g, '""') + '"'; }).join(';')).join('\r\n');
}
export function suggestedCategories(): Category[] {
  const names = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Impostos e taxas', 'Salário', 'Outras receitas'];
  const colors = ['#356f62', '#c39a55', '#7295ac', '#bb817e', '#9f8fc1', '#dcab79', '#80a6a1', '#a4977c', '#85939a', '#356f62', '#649987'];
  return names.map((name, i) => ({ id: id(), name, color: colors[i], archived: false, kind: i >= 9 ? 'income' : 'expense' }));
}
