import { describe, it, expect } from 'vitest';
import * as D from './domain';
const user = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const s = D.emptyState(); s.categories = D.suggestedCategories();
  const bank = { id: D.id(), name: 'Banco', color: '#356f62', archived: false }; s.banks.push(bank);
  const card: D.Card = { id: D.id(), name: 'Cartão', color: '#356f62', archived: false, limit: 100000, closingDay: 20, dueDay: 28 }; s.cards.push(card);
  const contact = { id: D.id(), name: 'Terceiro', color: '#356f62', archived: false }; s.contacts.push(contact);
  const entry = (kind: D.Entry['kind'], amount: number, extra: Partial<D.Entry> = {}): D.Entry => ({ id: D.id(), kind, amount, description: 'Teste', date: '2026-10-01', month: '2026-10', status: 'done', paidDate: '2026-10-01', paymentMethod: 'Pix', bankId: bank.id, notes: '', allocations: [{ categoryId: s.categories.find(c => c.kind === (kind === 'income' ? 'income' : 'expense'))!.id, amount }], createdBy: user, updatedAt: '2026-10-01T12:00:00Z', ...extra });
  return { s, card, contact, entry };
}
describe('Orçamento e dinheiro de terceiros', () => {
  it('soma salários e inclui despesas pendentes, sem repetir seu pagamento', () => {
    const { s, entry } = fixture(); s.entries = [entry('income', 200000), entry('income', 300000), entry('expense', 100000, { status: 'pending', paidDate: undefined })];
    expect(D.monthly(s, '2026-10').balance).toBe(400000);
    s.entries[2].status = 'done'; s.entries[2].paidDate = '2026-10-02'; expect(D.monthly(s, '2026-10').balance).toBe(400000);
    s.entries[2].status = 'cancelled'; expect(D.monthly(s, '2026-10').balance).toBe(500000);
  });
  it('mantém R$ 50 recebidos fora do saldo e usa o valor na fatura de R$ 150', () => {
    const { s, card, contact, entry } = fixture(); const cat = s.categories[0].id;
    s.entries.push(entry('income', 100000));
    let state = D.createPurchase(s, entry('expense', 15000, { cardId: card.id, allocations: [{categoryId:cat,amount:10000},{categoryId:cat,amount:5000,contactId:contact.id}] }), 1, '2026-10');
    const purchase = state.entries.find(e => e.cardId)!; const before = D.monthly(state, '2026-10').balance;
    state = D.addReceipt(state, { id:D.id(),date:'2026-10-02',amount:5000,notes:'',allocations:[{entryId:purchase.id,contactId:contact.id,amount:5000,replacement:false}] });
    expect(D.monthly(state,'2026-10').balance).toBe(before); expect(D.thirds(state).balance).toBe(5000); expect(D.thirds(state).outstanding).toBe(0);
    const paymentId=D.id(); const partial = D.payInvoice(state, {id:paymentId,cardId:card.id,month:'2026-10',date:'2026-10-03',amount:7500},2500);
    expect(D.thirds(partial).balance).toBe(2500); expect(D.invoice(partial,card.id,'2026-10').remaining).toBe(7500);
    state=D.payInvoice(partial,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-04',amount:7500},2500);
    expect(D.invoice(state,card.id,'2026-10').status).toBe('Paga'); expect(D.thirds(state).balance).toBe(0); expect(D.monthly(state,'2026-10').balance).toBe(before);
    expect(D.reportRows(state,'cash').filter(r=>r.kind==='expense').reduce((s,r)=>s+r.amount,0)).toBe(10000);
    expect(D.reportRows(state,'consumption').filter(r=>r.kind==='expense').reduce((s,r)=>s+r.amount,0)).toBe(10000);
    expect(D.payInvoice(partial,{id:paymentId,cardId:card.id,month:'2026-10',date:'2026-10-03',amount:7500},2500)).toBe(partial);
  });
  it('rejeita recebimento e uso superiores ao permitido', () => {
    const {s,card,contact,entry}=fixture(); const cat=s.categories[0].id;
    const state=D.createPurchase(s,entry('expense',5000,{cardId:card.id,allocations:[{categoryId:cat,contactId:contact.id,amount:5000}]}),1,'2026-10');
    expect(()=>D.addReceipt(state,{id:D.id(),date:'2026-10-01',amount:5001,notes:'',allocations:[{entryId:state.entries[0].id,contactId:contact.id,amount:5001,replacement:false}]})).toThrow(/supera/);
    expect(()=>D.payInvoice(state,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-02',amount:5000},1)).toThrow(/insuficiente/);
    expect(()=>D.payInvoice(state,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-02',amount:5001},0)).toThrow(/supera/);
  });
  it('reembolso após quitação continua separado e marcado como reposição',()=>{
    const {s,card,contact,entry}=fixture(); let state=D.createPurchase(s,entry('expense',5000,{cardId:card.id,allocations:[{categoryId:s.categories[0].id,contactId:contact.id,amount:5000}]}),1,'2026-10');
    state=D.payInvoice(state,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-02',amount:5000},0);
    state=D.addReceipt(state,{id:D.id(),date:'2026-10-03',amount:5000,notes:'',allocations:[{entryId:state.entries[0].id,contactId:contact.id,amount:5000,replacement:true}]});
    expect(D.thirds(state).balance).toBe(5000);expect(D.invoice(state,card.id,'2026-10').thirdAvailable).toBe(0);expect(D.monthly(state,'2026-10').income).toBe(0);
  });
  it('limita uso à obrigação restante após estorno com vários recebimentos',()=>{
    const {s,card,contact,entry}=fixture(); let state=D.createPurchase(s,entry('expense',15000,{cardId:card.id,allocations:[{categoryId:s.categories[0].id,amount:10000},{categoryId:s.categories[0].id,contactId:contact.id,amount:5000}]}),1,'2026-10');
    const purchase=state.entries[0];
    for(let i=0;i<2;i++) state=D.addReceipt(state,{id:D.id(),date:'2026-10-01',amount:2500,notes:'',allocations:[{entryId:purchase.id,contactId:contact.id,amount:2500,replacement:false}]});
    state=D.refundEntry(state,purchase.id,7500,'2026-10-02','2026-10',user);
    expect(D.invoice(state,card.id,'2026-10').thirdAvailable).toBe(2500);
    expect(()=>D.payInvoice(state,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-03',amount:7500},5000)).toThrow(/insuficiente/);
    state=D.payInvoice(state,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-03',amount:7500},2500);
    expect(D.thirds(state).balance).toBe(2500); expect(D.thirds(state).returnable).toBe(2500);
  });
});
describe('Parcelas, categorias, datas e estornos',()=>{
  it('preserva valor total e todas as divisões no parcelamento',()=>{
    const {s,card,contact,entry}=fixture(); const state=D.createPurchase(s,entry('expense',10000,{cardId:card.id,allocations:[{categoryId:s.categories[0].id,amount:6667},{categoryId:s.categories[1].id,contactId:contact.id,amount:3333}]}),3,'2026-10');
    expect(state.entries.map(e=>e.amount)).toEqual([3334,3333,3333]);expect(state.entries.map(e=>e.month)).toEqual(['2026-10','2026-11','2026-12']);
    expect(state.entries.flatMap(e=>e.allocations).filter(a=>a.contactId).reduce((s,a)=>s+a.amount,0)).toBe(3333);
    expect(state.entries.every(e=>e.allocations.reduce((s,a)=>s+a.amount,0)===e.amount)).toBe(true);
    expect(()=>D.createPurchase(s,entry('expense',10000,{cardId:card.id,allocations:[{categoryId:s.categories[0].id,amount:6667},{categoryId:s.categories[1].id,amount:3332}]}),3,'2026-10')).toThrow(/exatamente/);
  });
  it('não contabiliza o total integral em cada categoria',()=>{
    const {s,entry}=fixture(); s.entries.push(entry('expense',30000,{allocations:[{categoryId:s.categories[0].id,amount:20000},{categoryId:s.categories[1].id,amount:10000}]}));
    expect([...D.monthly(s,'2026-10').categoryTotals.values()]).toEqual([20000,10000]);
    s.entries[0].allocations[0].amount=19999;expect(()=>D.validateState(s)).toThrow();
  });
  it('sugere fatura conforme fechamento e ajusta fevereiro',()=>{
    const {card}=fixture(); expect(D.suggestInvoice(card,'2026-10-19')).toBe('2026-10');expect(D.suggestInvoice(card,'2026-10-20')).toBe('2026-11');
    expect(D.suggestInvoice({...card,dueDay:5},'2026-10-19')).toBe('2026-11');expect(D.monthDate('2026-02',31)).toBe('2026-02-28');
  });
  it('estorno depois de receber cria excedente a devolver, sem receita própria',()=>{
    const {s,card,contact,entry}=fixture();let state=D.createPurchase(s,entry('expense',5000,{cardId:card.id,allocations:[{categoryId:s.categories[0].id,contactId:contact.id,amount:5000}]}),1,'2026-10');
    state=D.addReceipt(state,{id:D.id(),date:'2026-10-01',amount:5000,notes:'',allocations:[{entryId:state.entries[0].id,contactId:contact.id,amount:5000,replacement:false}]});
    state=D.refundEntry(state,state.entries[0].id,2000,'2026-10-02','2026-10',user);
    expect(D.thirds(state).returnable).toBe(2000);expect(D.monthly(state,'2026-10').income).toBe(0);expect(()=>D.refundEntry(state,state.entries[0].id,3001,'2026-10-03','2026-10',user)).toThrow();
  });
  it('carrega crédito de estorno para a próxima fatura',()=>{
    const {s,card,entry}=fixture();let state=D.createPurchase(s,entry('expense',10000,{cardId:card.id}),1,'2026-10');const purchase=state.entries[0];
    state=D.payInvoice(state,{id:D.id(),cardId:card.id,month:'2026-10',date:'2026-10-02',amount:10000},0);
    state=D.refundEntry(state,purchase.id,5000,'2026-10-03','2026-10',user);state=D.createPurchase(state,entry('expense',7000,{cardId:card.id}),1,'2026-11');
    expect(D.invoice(state,card.id,'2026-11').remaining).toBe(2000);
  });
});
describe('Recorrência, relatórios e arquivos',()=>{
  it('gera sem duplicar, preserva pagamentos e identifica atrasos',()=>{
    const {s,entry}=fixture();const template=entry('expense',10000,{status:'pending',paidDate:undefined,date:'2026-01-31',month:'2026-01'});
    const series:D.Series={id:D.id(),template,frequency:'monthly',start:'2026-01-31',generatedUntil:'2026-01-31',archived:false};
    let state=D.generateSeries(s,series,'2026-03-31');expect(state.entries.map(e=>e.date)).toEqual(['2026-01-31','2026-02-28','2026-03-31']);
    state=D.generateSeries(state,state.series[0],'2026-03-31');expect(state.entries).toHaveLength(3);expect(D.effectiveStatus(state.entries[0],'2026-02-01')).toBe('overdue');
    state.entries[0].status='done';state.entries[0].paidDate='2026-01-31';state=D.editSeries(state,{...state.entries[1],description:'Nova descrição'},'all');expect(state.entries[0].description).toBe('Teste');expect(state.entries[2].description).toBe('Nova descrição');
  });
  it('separa caixa e competência e evita porcentagem sem base',()=>{
    const {s,entry}=fixture();s.entries.push(entry('expense',15000,{date:'2026-09-29',month:'2026-09',paidDate:'2026-10-02'}));
    expect(D.reportRows(s,'cash')[0].date).toBe('2026-10-02');expect(D.reportRows(s,'consumption')[0].date).toBe('2026-09-29');expect(D.variation(0,100)).toBeNull();expect(D.variation(100,150)).toBe(50);
  });
  it('preserva histórico ao arquivar e restaura JSON válido',()=>{
    const {s,entry}=fixture();s.entries.push(entry('expense',10000));s.categories[0].archived=true;
    const restored=D.validateState(JSON.parse(JSON.stringify(s)));expect(D.monthly(restored,'2026-10').spent).toBe(10000);
  });
  it('CSV protege fórmulas e centavos são exatos',()=>{
    expect(D.cents('1.234,56')).toBe(123456);expect(D.cents('0,01')).toBe(1);expect(()=>D.cents('1,001')).toThrow();expect(D.csv([['=HYPERLINK("x")',12345]])).toContain("'=HYPERLINK");expect(D.csv([['Teste',12345]])).toContain('123,45');
  });
});
