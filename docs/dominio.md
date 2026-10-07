# Modelo e regras financeiras

[Índice](README.md) · Implementação: [domain.ts](../src/domain.ts)

## Convenções e invariantes

Todos os valores persistidos são inteiros positivos em centavos, até `100000000000` (R$ 1 bilhão por valor). Cálculos derivados podem resultar em zero ou negativos. Não persistir números decimais em reais. Datas civis usam `YYYY-MM-DD`; competências usam `YYYY-MM`. `today()` usa America/Sao_Paulo; deslocamentos de datas usam UTC para evitar conversão da data civil por fuso. `updatedAt` é uma string produzida pelos formulários com `toISOString()`; o schema local não valida sua semântica de timestamp.

IDs são UUIDs e únicos dentro de cada coleção. Categorias têm no máximo dois níveis, com tipo igual ao da categoria principal. Cada divisão deve referenciar categoria do tipo correto e escolher no máximo um entre responsável pessoal e contato externo. A soma das divisões deve ser exatamente o total do lançamento/recebimento.

Participantes possuem login e função no espaço. Contatos são terceiros sem acesso. Uma divisão sem `contactId` é pessoal, inclusive quando compartilhada; ausência de `ownerId` significa compartilhado/não atribuído. Terceiros nunca entram na receita pessoal ou no saldo do orçamento. Bancos são identificações, sem conta, saldo ou transferência interna.

`done` em uma compra de cartão indica a compra registrada; não significa fatura paga. A obrigação da fatura deriva de `payments`. `overdue` é uma apresentação calculada, não um status persistido. Registros cancelados ficam fora dos totais financeiros.

## Tipos persistidos

| Tipo | Campos e significado |
|---|---|
| `Role`, `Status` | `admin/editor/reader`; `pending/done/cancelled`. |
| `Entity` | `id`, `name`, `color` hexadecimal e `archived`; base de bancos e contatos. Arquivar mantém referências históricas. |
| `Category` | Base + `kind: income/expense`, `parentId?`. |
| `Card` | Base + `bankId?`, `holderId?`, `limit` em centavos, `closingDay`, `dueDay` entre 1 e 31 e `last4?`. |
| `Allocation` | `categoryId`, `amount`, `ownerId?` ou `contactId?`; separa finalidade e responsável. |
| `Entry` | `id`, `kind: income/expense/refund`, `description`, `amount`, `plannedAmount?`, `date`, `month`, `dueDate?`, `paidDate?`, `status`, `bankId?`, `cardId?`, `paymentMethod`, `notes`, `allocations`, `createdBy`, `updatedAt`, `purchaseOriginal?` (total e divisões originais, sem efeito nos totais financeiros). |
| Vínculos de `Entry` | `purchaseId?` agrupa parcelas; `installment?` e `installmentCount?` identificam posição; `seriesId?` liga recorrência; `originalId?` liga estorno à despesa. |
| `ReceiptAllocation` | `entryId`, `contactId`, `amount`, `replacement`. O último marca reposição após obrigação já realizada/quitada. |
| `Receipt` | `id`, `date`, `bankId?`, `amount`, `notes`, `allocations`. Recebimento separado de receitas próprias. |
| `Usage` | `receiptId`, `entryId`, `contactId`, `amount`; destinação de recebimento ao pagamento. |
| `Payment` | `id`, `cardId`, `month`, `date`, `bankId?`, `amount`, `uses`. Pagamento parcial ou total da fatura. |
| `Return` | `id`, `receiptId`, `entryId`, `contactId`, `amount`, `date`, `bankId?`; devolução de excedente. |
| `Series` | `id`, `template: Entry`, `frequency: daily/weekly/monthly/yearly`, `start`, `end?`, `generatedUntil`, `archived`. |
| `Budget` | `id`, `month`, `categoryId`, `amount`; único por mês e categoria principal de despesa. |
| `State` | `version: 1` e arrays `banks`, `categories`, `cards`, `contacts`, `entries`, `receipts`, `payments`, `returns`, `series`, `budgets`. |
| `Member` | `userId`, `name`, `email`, `role`, `active`; vem de tabela relacional, fora de `State`. |
| `Invoice` | Projeção derivada: cartão, mês, vencimento, lançamentos, total, pago, restante, saldo de terceiro utilizável, parcela pessoal/terceiro e status. Não é persistida. |
| `ReportRow` | Linha derivada com ID, descrição, data, tipo `income/expense/third-in/third-out`, valor, vínculos opcionais, recorrência e status opcional. |

`stateSchema` exporta os schemas Zod agregados. Exige nomes de 1–120 caracteres, descrições de 1–300, observações até 2.000, forma de pagamento até 100, cor `#RRGGBB`, 1–100 divisões por lançamento e até 120 parcelas. Lançamento direto realizado exige `paidDate`. Receita não pode ter cartão nem terceiro.

`validateState(input)` faz parse e valida referências, IDs duplicados, hierarquia de categorias, ocorrências duplicadas por série/data, estornos por divisão, recebimentos relacionados, saldos disponíveis, usos da mesma fatura e data, devoluções vinculadas e unicidade de orçamento. Retorna o estado validado ou lança erro. Não recebe a lista de participantes nem o snapshot anterior: existência de autores/responsáveis e regras de transição também são verificadas pelo [banco](banco.md). Não tratar a validação local como equivalente integral à validação SQL.

## Contratos das funções auxiliares

| Função | Contrato |
|---|---|
| `emptyState()` | Cria documento v1 com todas as coleções vazias. |
| `id()` | Gera UUID via `crypto.randomUUID()`. |
| `today()`, `currentMonth()` | Dia civil em São Paulo e seus primeiros sete caracteres. |
| `money(cents)` | Formata centavos como BRL `pt-BR`; usar apenas na apresentação. |
| `dateLabel(date?)` | Inverte componentes para `DD/MM/YYYY`; ausente produz travessão. Não valida a data. |
| `cents(text)` | Aceita valor positivo com até duas casas, remove símbolo/espaços e usa vírgula como decimal quando presente. `1.234,56` vira 123456; ponto sem vírgula é decimal. Rejeita zero, negativos, frações adicionais e valores fora do limite. |
| `addMonths(month, amount)` | Desloca competência com data UTC no primeiro dia. |
| `monthDate(month, day)` | Constrói data ajustando o dia ao último do mês; pressupõe mês/dia válidos. |
| `shiftDays(date, days)` | Desloca dia civil usando meio-dia UTC. |
| `suggestInvoice(card, date)` | Compra no fechamento ou depois avança o mês de fechamento. Se vencimento é no mesmo dia ou antes do fechamento, a competência avança mais um mês. A interface permite ajustar a sugestão. |
| `closingDate(card, invoiceMonth)` | Recupera fechamento do ciclo correspondente à competência. |
| `splitCents(total, count)` | Divide em 1–120 partes, com ao menos um centavo em cada; restos vão para as primeiras parcelas. |
| `proportional(total, weights)` | Calcula proporções inteiras com BigInt; distribui restos pela maior fração, desempate pelo índice. Soma dos pesos zero retorna zeros. Pressupõe inteiros não negativos. |
| `personalAmount(entry)`, `thirdAmount(entry)` | Soma sem contato externo; restante do total, respectivamente. |
| `effectiveStatus(entry, date?)` | Retorna `overdue` para pendente com vencimento anterior à data; demais mantêm status. |
| `alertGroups(state, date?, invoiceMonth?)` | Contas e receitas diretas pendentes até sete dias à frente, incluindo atrasadas; faturas com restante positivo na mesma janela. Sem `invoiceMonth`, considera todos os meses. Quando informado, restringe somente as faturas à competência escolhida; contas e receitas mantêm seu alcance global. |
| `categoryRoot(state, categoryId)` | ID do pai, se existente, ou da própria categoria. |
| `variation(before, after)` | `(after-before)/abs(before)*100`; base zero retorna `null`. |
| `csv(rows)` | BOM UTF-8, separador `;`, CRLF, campos entre aspas, escape de aspas e prefixo seguro para textos que podem executar fórmula. Todo número é tratado como centavos e convertido com vírgula decimal; passar contagens como texto. |
| `suggestedCategories()` | Gera nove categorias de despesa e duas de receita, com cores e UUIDs novos. |

## Compras e realização

`createPurchase(state, template, count, firstMonth, startInstallment=1)` gera somente as parcelas de `startInstallment` até `count`. O `template.amount` é a soma **das parcelas a registrar**, não o preço original se parcelas anteriores forem omitidas. Valida total distribuído e cartão ativo, divide valores e divisões preservando centavos, gera `purchaseId` e IDs das parcelas, desloca competências e define vencimentos. Cada parcela fica `done`, sem `paidDate`. Retorna novo estado validado.

O formulário novo usa `createPurchaseFromOriginal(state, template, count, firstMonth, startInstallment=1)`: `template.amount` e divisões representam a compra inteira. Distribui centavos e categorias em todas as parcelas antes de omitir as anteriores à inicial; somente as selecionadas são persistidas, sem gerar receitas, pagamentos ou registros históricos omitidos. O argumento `firstMonth` dessas funções corresponde à parcela inicial efetiva; o formulário converte o campo Primeira fatura original para essa competência antes de chamar o domínio. Cada parcela conserva `purchaseOriginal: { amount, allocations }`, metadado opcional validado pelo schema e usado para edição e backup.

`purchaseSchedule(total, count, firstMonth, startInstallment=1, originalTotal=true)` valida valores, quantidade, parcela inicial e mês; fornece valores/numeração/faturas da prévia. Com `originalTotal=false`, conserva o cálculo antigo sobre o total das parcelas cadastradas.

Exemplo fictício: 10.001 centavos em seis parcelas, a partir da terceira, registra 1.667, 1.667, 1.667 e 1.666, totalizando 6.667. Editar compra remove o grupo e o recria; vínculos existentes podem impedir a operação. Cadastros antigos parciais sem metadados conservam o modo anterior; mudar para total original exige opção explícita e novo preenchimento.

A realização de uma conta/receita direta acontece no `SettleForm`: altera o mesmo lançamento, conserva o primeiro valor previsto em `plannedAmount`, atualiza valor real/data e redistribui proporções. Não cria despesa duplicada nem pagamento de fatura.

## Terceiros e faturas

| Função | Cálculo/efeito |
|---|---|
| `thirdDebt(state, entryId, contactId)` | Parte original do contato menos estornos não cancelados; inexistente/cancelado resulta em zero. |
| `receivedFor(state, entryId, contactId)` | Recebimentos vinculados menos devoluções para a mesma compra/pessoa. |
| `usedFrom(state, receiptId, entryId?, contactId?)` | Soma usos em pagamentos, com filtros opcionais. |
| `availableReceipt(state, receipt, allocation)` | Parte recebida menos usos e devoluções desse vínculo. |
| `thirdUnusedDebt(state, entryId, contactId)` | Obrigação líquida menos uso já registrado, limitada a zero. |
| `thirds(state)` | Linhas por despesa/contato; `outstanding` soma valores a receber; `balance` soma recebimentos disponíveis; `returnable` soma excesso recebido sobre dívida. |
| `invoice(state, cardId, month)` | Calcula compras menos estornos, pagamentos, crédito anterior e restante. Calcula saldo de terceiro limitado ao vínculo, dívida ainda não usada e restante da fatura; exclui reposições. Cartão inexistente lança erro. |
| `invoices(state)` | Obtém pares cartão/mês das entradas e ordena projeções pelo vencimento. |
| `addReceipt(state, receipt)` | ID já existente retorna estado atual. Novo recebimento não pode superar a dívida ainda a receber; adiciona e valida estado. |
| `payInvoice(state, payment, thirdUse)` | ID existente retorna estado atual. Valor não pode superar restante; uso deve caber no pagamento e saldo. Percorre recebimentos na ordem armazenada e exige disponibilidade até a data do pagamento. Adiciona `uses` e valida. |

Crédito de fatura é calculado cronologicamente: para competências anteriores, `credit = max(0, credit + pagamentos - compras líquidas)`. O restante atual é `max(0, compras líquidas - credit - pagamentos atuais)`. O total exibido já desconta crédito anterior; a parcela pessoal/terceiro deriva dos lançamentos do mês. Status da fatura: paga quando sem restante e com pagamento/entrada; parcial se houve pagamento; fechada se atingiu fechamento; aberta nos demais casos.

Uma compra de 15.000, com 10.000 pessoais e 5.000 de terceiro, consome 10.000 do orçamento. Receber 5.000 mantém esse consumo e gera saldo separado. Pagar 15.000 usando 5.000 de terceiros quita a fatura e consome o saldo separado; o orçamento continua com 10.000 de gasto. Vincular recebimento sozinho não quita a fatura.

`ReceiptForm` marca `replacement` quando a fatura já está quitada ou a despesa direta já está realizada. Reposições permanecem separadas e não são utilizáveis no pagamento de fatura. Devoluções são limitadas ao menor entre excedente recebido e disponibilidade do recebimento escolhido.

## Estornos, exclusões e recorrências

`refundEntry(state, entryId, amount, date, month, userId)` exige despesa não cancelada, limita o valor ao ainda não estornado e distribui proporcionalmente pelas divisões restantes. Cria entrada `refund` ligada por `originalId`, preservando cartão e responsáveis, removendo vínculo de parcela/compra/série. Estorno diminui consumo, pode gerar crédito na fatura e excesso a devolver a terceiro; não vira receita pessoal.

`removeEntry(state, entryId)` não altera estado se ID inexistente. Bloqueia exclusão com recebimentos, estornos relacionados ou pagamento da fatura do mesmo cartão/mês. Exclusão da compra inteira no `App` executa essa verificação em todas as parcelas e só grava após terminar.

`occurrenceDate(start, frequency, index)` desloca dias, semanas, meses ou anos, ajustando dias inexistentes. `generateSeries(state, series, until)` retorna estado atual se arquivada; cria ocorrências pendentes sem duplicar série/data, até menor data entre término e horizonte. Há limite interno de 10.000 iterações; `generatedUntil` registra a maior data já gerada, limitada pelo término quando houver. Não há serviço agendado: a geração é acionada na interface.

`editSeries(state, entry, scope)` altera uma ocorrência em `one`; nos escopos `future/all`, atualiza template e ocorrências pendentes abrangidas, preservando datas e campos realizados das demais. A entrada selecionada é substituída conforme o argumento. Campos propagados: descrição, valor, banco, forma de pagamento, observações, divisões e atualização. Excluir uma ocorrência permite regenerá-la; cancelar conserva a chave e exclui seus valores dos totais.

## Indicadores e relatórios

### Escopo e totais das consultas

`EntryScope = { portion?, categoryId?, responsible? }` é uma projeção não persistida. `scopedAllocations(state, entry, scope)` intersecta parte, categoria (a própria ou a raiz) e responsável (`member:UUID`, `contact:UUID` ou `shared`). `scopedAmount` soma somente essas divisões em centavos. Não altera o lançamento nem o dinheiro de terceiros.

`entrySelectionTotals(state, entries, scope)` recebe os registros já filtrados por período/descrição/tipo/banco/cartão/status e retorna `income`, `expenses`, `refunds`, `net` e `cancelled`. Ignora divisões fora do escopo, inclui despesas pendentes, exclui cancelados dos valores e calcula `net = income + refunds - expenses`. Esse resultado é um subtotal da consulta, não saldo real nem nova movimentação.

`thirdSelection(state, month, contactId='')` deriva linhas de `thirds`, recebimentos por divisão e devoluções vinculados a entradas com `Entry.month` escolhido, limitando pessoa quando informada. Retorna `lines`, `receipts: {receipt, allocation}[]`, `returns`, `debt`, `received` (líquido de devoluções), `outstanding`, `balance` e `returnable`. Saldo soma `availableReceipt` de cada divisão escolhida, descontando usos/devoluções; a data do recebimento não restringe a consulta por competência. Não conta o recebimento inteiro quando parte pertence a outro mês/pessoa. `thirds(state)` continua global, usado no painel e regras de recebimento/pagamento.

### Parcelas mensais sem cartão

`billInstallmentSchedule(amount, count, start, dueDate)` recebe o valor **de cada parcela** em centavos, total original (1–120), parcela inicial e próximo vencimento. Retorna somente `start..count`, com o mesmo valor e vencimentos mensais ancorados no dia inicial (31 → último dia de fevereiro → 31 de março). Não divide um preço total.

`createBillInstallments(state, template, count, start, dueDate)` cria uma nova despesa sem cartão como série mensal finita. O template conserva a data original como referência; `Series.start` é o próximo vencimento e `end` é o último. `template.installment/installmentCount` definem numeração e término usando campos existentes. Todas as parcelas restantes são geradas atomicamente; as anteriores não são reconstruídas. Só a inicial pode vir realizada, com data de pagamento; as demais ficam pendentes. Não cria `purchaseId`, cartão, fatura, receita ou pagamento adicional.

Cada ocorrência tem `date`, `month` e `dueDate` do vencimento previsto, portanto aparece no orçamento/consumo do mês correspondente. Realização mantém o mesmo ID; valor efetivamente pago pode diferir e `plannedAmount` preserva o previsto. Fluxo de caixa usa `paidDate`; o orçamento considera a parcela uma única vez. Divisões são valores de cada parcela, inclusive terceiros, sempre fora dos totais pessoais.

`generateSeries` limita a numeração ao total e evita repetição também por série/parcela, mesmo se uma ocorrência tiver sua data editada. `validateState` valida término, frequência mensal, numeração e unicidade dessas séries. `editSeries` mantém as demais pagas, numeração e datas; substitui a selecionada inclusive quando ela passa de pendente a paga em escopo `future/all`. No parcelamento finito, todas as ocorrências já existem, então editar próximas não exige gerar novos meses. Excluir remove apenas a ocorrência; cancelar preserva a chave. Não há antecipação automática, cálculo de juros nem alteração em lote dos vencimentos.

`monthly(state, month, cutoff?)` retorna `income`, `projected`, `spent`, `balance`, `projectedBalance`, `expenses` e `categoryTotals` (Map). Receita realizada considera `paidDate`; projetada considera competência de receitas pendentes. Consumo considera despesas/estornos não cancelados em `month`, somente parcelas pessoais. No recorte por dia, cartão usa vencimento (ou data) e lançamento direto usa data do lançamento. Categorias são agrupadas na principal.

`balance = income - spent`; `projectedBalance = income + projected - spent`. Inclui despesas pendentes; não transporta sobras de meses anteriores. O saldo é de planejamento, sem posição bancária.

`reportRows(state, perspective, includeThird=false)` produz linhas por divisão. Em `consumption`, despesas diretas usam data do lançamento, cartão usa dia de vencimento na competência e receitas usam data do lançamento, incluindo previstas. Em `cash`, apenas lançamentos diretos realizados usam `paidDate`; compras do cartão são omitidas e pagamentos da fatura entram pela data de pagamento, com parte própria `amount - usos`. Quando solicitado, recebimentos, devoluções e pagamentos com terceiros aparecem separadamente.

Estorno pessoal é despesa negativa. Em caixa, estorno direto de terceiro aparece como entrada de terceiro. Os totais de receita dos relatórios por competência podem diferir de `monthly.income`, pois usam datas e status diferentes. Manter essa distinção em novas telas e exportações.

## Sugestão da fatura para novas compras

`registrationStart(firstInvoice, requested, minimumMonth?)` calcula a parcela efetiva: maior entre a solicitada e a numeração que corresponde ao mês mínimo, quando informado. O formulário novo usa o mês atual como mínimo apenas para a parcela, permitindo informar a primeira fatura original no passado. Passa às funções de compra a competência primeira fatura original + parcela efetiva - 1; o contrato dessas funções não muda. Na edição, não aplica mínimo e recupera a primeira fatura original subtraindo a numeração da primeira parcela salva. `suggestInvoice` permanece a sugestão do ciclo ajustável pelo usuário. O helper anterior que limitava o mês original foi removido. Faturas continuam sendo projeções.
