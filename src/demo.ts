import { addMonths, createPurchase, currentMonth, emptyState, id, monthDate, suggestedCategories, today, type Entry, type State } from './domain';
import { DEMO_USER } from './storage';
export function demoData(): State {
  let state = emptyState(); state.categories = suggestedCategories();
  const bank = { id: id(), name: 'Banco exemplo', color: '#356f62', archived: false }; state.banks.push(bank);
  const card = { id: id(), name: 'Cartão exemplo', color: '#356f62', archived: false, limit: 800000, closingDay: 20, dueDay: 28, bankId: bank.id }; state.cards.push(card);
  const contact = { id: id(), name: 'Pessoa exemplo', color: '#c39a55', archived: false }; state.contacts.push(contact);
  const category = (name: string) => state.categories.find(c => c.name === name)!.id;
  const month = currentMonth();
  const entry = (description: string, amount: number, kind: Entry['kind'], cat: string, m: string, day: number, status: Entry['status'] = 'done'): Entry => ({ id: id(), description, amount, kind, date: monthDate(m, day), month: m, dueDate: monthDate(m, day), status, paidDate: status === 'done' ? monthDate(m, day) : undefined, bankId: bank.id, paymentMethod: 'Pix', notes: 'Dado fictício e removível.', allocations: [{ categoryId: category(cat), amount }], createdBy: DEMO_USER, updatedAt: new Date().toISOString() });
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(month, -i);
    state.entries.push(entry('Salário · exemplo', 520000 + i * 7500, 'income', 'Salário', m, 1));
    state.entries.push(entry('Moradia · exemplo', 135000, 'expense', 'Moradia', m, 1));
    state.entries.push(entry('Supermercado · exemplo', 63000 + i * 3000, 'expense', 'Alimentação', m, 2));
    if (i > 0) { state.entries.push(entry('Transporte · exemplo', 31000 + i * 2100, 'expense', 'Transporte', m, 4)); state.entries.push(entry('Cinema · exemplo', 17000 + i * 3300, 'expense', 'Lazer', m, 9)); }
  }
  state.entries.push(entry('Internet · exemplo', 11990, 'expense', 'Assinaturas', month, Math.min(28, Number(today().slice(8)) + 3), 'pending'));
  const purchase = { ...entry('Compra compartilhada · exemplo', 15000, 'expense', 'Compras', month, 2), cardId: card.id, allocations: [{ categoryId: category('Compras'), amount: 10000 }, { categoryId: category('Compras'), amount: 5000, contactId: contact.id }] };
  state = createPurchase(state, purchase, 1, month);
  state = createPurchase(state, { ...entry('Notebook · exemplo', 240000, 'expense', 'Compras', month, 1), cardId: card.id }, 6, month);
  state.budgets = [{ id: id(), month, categoryId: category('Alimentação'), amount: 100000 }, { id: id(), month, categoryId: category('Compras'), amount: 80000 }, { id: id(), month, categoryId: category('Lazer'), amount: 40000 }];
  return state;
}
