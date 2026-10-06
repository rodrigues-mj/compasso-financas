import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntryForm } from './forms';
import { Cards, type PageProps } from './pages';
import * as D from './domain';

const userId = '11111111-1111-4111-8111-111111111111';
function setup() {
  const state = D.emptyState(); state.categories = D.suggestedCategories();
  const card: D.Card = { id: D.id(), name: 'Cartão de exemplo', archived: false, color: '#356f62', limit: 100000, closingDay: 20, dueDay: 28 };
  state.cards.push(card);
  const template: D.Entry = { id: D.id(), kind: 'expense', description: 'Compra de exemplo', amount: 10001, allocations: [{ categoryId: state.categories[0].id, amount: 10001 }], date: '2026-10-01', month: '2026-10', status: 'done', cardId: card.id, paymentMethod: 'Cartão de crédito', notes: '', createdBy: userId, updatedAt: '2026-10-01T12:00:00Z' };
  const render = (s: D.State, entry?: D.Entry) => renderToStaticMarkup(createElement(EntryForm, { state: s, entry, members: [], userId, defaultCard: card.id, defaultMonth: '2026-10', busy: false, commit: async () => {}, cancel: () => {} }));
  return { state, template, render };
}
describe('Formulário de parcelamento', () => {
  it('permite escolher primeira fatura histórica e recupera o mês original ao editar', () => {
    const { state, template, render } = setup();
    expect(render(state)).not.toContain(`min="${D.currentMonth()}"`);
    expect(render(state)).toContain('Primeira fatura original');
    const saved = D.createPurchaseFromOriginal(state, template, 6, '2026-08', 3);
    const html = render(saved, saved.entries[0]);
    expect(html).toContain('value="2026-06"');
    expect(html).not.toContain(`min="${D.currentMonth()}"`);
  });
  it('pede o total original e informa como visualizar as faturas', () => {
    const { state, render } = setup(); const html = render(state);
    expect(html).toContain('Valor total original da compra');
    expect(html).toContain('Número total de parcelas');
    expect(html).toContain('Registrar a partir da parcela');
    expect(html).toContain('Confira o que será registrado');
    expect(html).not.toContain('Valor total das parcelas restantes');
  });
  it('reabre o total original e mostra somente as parcelas registradas', () => {
    const { state, template, render } = setup();
    const saved = D.createPurchaseFromOriginal(state, template, 6, '2026-10', 3);
    const html = render(saved, saved.entries[0]);
    expect(html).toContain('value="100,01"');
    expect(html).toContain('Total a registrar:');
    expect(html).toContain('66,67');
    expect(html).toContain('janeiro de 2027');
    expect(html).toContain('readOnly');
    expect(html).not.toContain('Informar o total original e recalcular');
  });
  it('não inventa o total original de uma compra parcial antiga', () => {
    const { state, template, render } = setup();
    const saved = D.createPurchase(state, template, 6, '2026-10', 3);
    const html = render(saved, saved.entries[0]);
    expect(html).toContain('Total das parcelas cadastradas');
    expect(html).toContain('value="100,01"');
    expect(html).toContain('Informar o total original e recalcular');
    expect(html).not.toContain('Total original:');
  });
});

describe('Faturas por mês', () => {
  it('mostra apenas o mês escolhido e mantém as parcelas futuras no estado', () => {
    const { state, template } = setup();
    const saved = D.createPurchaseFromOriginal(state, template, 6, '2026-08', 3);
    const noop = () => {};
    const props: PageProps = { state: saved, members: [], month: '2026-10', writable: true, openEntry: noop, newEntry: noop, editEntity: noop, openPayment: noop, openReceipt: noop, openReturn: noop, openBudget: noop, showEntries: noop, commit: async () => {} };
    const october = renderToStaticMarkup(createElement(Cards, props));
    expect(october).toContain('outubro de 2026 · vence');
    expect(october).not.toContain('agosto de 2026 · vence');
    expect(october).not.toContain('novembro de 2026 · vence');
    const november = renderToStaticMarkup(createElement(Cards, { ...props, month: '2026-11' }));
    expect(november).toContain('novembro de 2026 · vence');
    expect(november).not.toContain('outubro de 2026 · vence');
    expect(saved.entries.map(e => e.installment)).toEqual([3, 4, 5, 6]);
  });
});
