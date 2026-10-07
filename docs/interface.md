# Interface e fluxos

[Índice](README.md) · [App](../src/App.tsx) · [páginas](../src/pages.tsx) · [formulários](../src/forms.tsx) · [componentes](../src/components.tsx)

## Totais das consultas e competência de terceiros

`SelectionTotals` recebe pares de rótulo/centavos, título e explicação; apresenta um resumo acessível que atualiza com os resultados, inclusive zerados. `EntryTotals` usa `entrySelectionTotals` para receitas, despesas, estornos e resultado (receitas + estornos − despesas), inclui pendentes e exclui cancelados com aviso explícito. Não representa saldo bancário. `EntryTable.showTotals` ativa o resumo nos diálogos dos indicadores; nas páginas de lançamentos e contas, fica acima da lista/calendário sem duplicação. O calendário restringe também ao mês visível, inclusive exportação e total.

Filtros por categoria (raiz ou subcategoria), parte pessoal/terceiro/total e responsável intersectam as divisões. `Todos os responsáveis` inclui participantes, contatos externos e compartilhados; não concede acesso a terceiros. Detalhes abrem o lançamento original completo. CSV, ordenação por valor, categorias, responsáveis e valores da tabela seguem o mesmo escopo. Os indicadores de próximos 7/30 dias e atrasados mantêm alcance em todos os períodos, explicitamente indicado; respeitam parte/categoria/responsável. O resumo **Totais da seleção** segue todos os filtros da lista, incluindo datas, descrição, tipo, banco, cartão e status.

`Thirds` aplica mês selecionado e pessoa a obrigações, três indicadores, recebimentos e devoluções via `thirdSelection`. O mês é `Entry.month` da compra/parcela; pagamentos, recebimentos antecipados ou atrasados e devoluções de qualquer data são apresentados quando vinculados a essa competência. Um recebimento dividido entre pessoas/meses contribui somente com suas divisões correspondentes. Resumos mostram devido, recebido líquido de devoluções, a receber, recebimentos brutos vinculados, saldo disponível e devoluções. O estado de pessoa permanece ao trocar mês; mudança de espaço reinicia a seleção. Contatos externos continuam sendo um cadastro global do espaço. O painel principal mantém o saldo global de terceiros e agora informa **todos os meses**.

Cartões e faturas resumem somente faturas do mês/cartão exibidos e opção de arquivados: total, pago, restante e terceiros disponíveis. Pagamentos listados usam mês da fatura (não data do pagamento) e exibem total pago e origem própria/terceira. Restante pode incluir créditos anteriores. Relatórios resumem as linhas do segundo mês, perspectiva, recorte e agrupamento selecionados, separando entradas/saídas de terceiros do resultado pessoal. Os indicadores gerais/comparação continuam separados desse resumo de registros. Bancos e categorias são cadastros sem saldo; orçamentos já possuem planejado/consumido/restante por mês.

## Parcelamento de boletos e financiamentos

Em uma nova despesa sem cartão, `EntryForm` oferece **Despesa parcelada sem cartão (boleto, carnê ou financiamento)**. Ao ativar, status inicial fica pendente e recorrência comum é desativada. O valor passa a ser de cada parcela; informe total original, parcela inicial e próximo vencimento obrigatório. A data do contrato fica como referência. A prévia mostra quantidade restante, total previsto, numeração e último vencimento, com lista expandível. Só a primeira cadastrada pode ser marcada paga; as próximas permanecem pendentes.

Ao editar, o formulário reabre apenas o valor da ocorrência, com sua numeração, término e data de referência. É possível alterar somente a ocorrência, esta e as próximas pendentes ou a série pendente, preservando as demais pagas. A conversão de recorrência/parcelamento em cartão é bloqueada. Pagamento via `SettleForm` conserva o previsto, a numeração e o vínculo; não cria outro lançamento.

Listas e detalhes mostram a posição da parcela; calendário e CSV também incluem `n/total`. Filtros mensais continuam limitando a exibição ao período escolhido. O resumo de recorrências identifica o intervalo cadastrado e **Todas as parcelas geradas**; esse texto não significa que os boletos foram pagos. A geração adicional fica desabilitada quando o término já foi atingido. Pausar geração não cancela ocorrências já existentes.

## Coordenação em App.tsx

`App` centraliza sessão, prontidão, modo fictício, lista/seleção de espaços, participantes, snapshot, carregamento, página, mês e diálogo. Também controla gravação em andamento, mensagens, aviso de alteração remota, menu móvel e recuperação de senha. `NAV`, `Page` e `titles` associam as dez opções de navegação; `Dialog` é união discriminada que determina formulário e argumentos do modal.

Inicialização: consulta sessão e assina `onAuthStateChange`; no exemplo carrega IndexedDB ou gera `demoData`. No modo real, após login tenta aceitar convite da URL, limpa query em caso de sucesso, consulta espaços e escolhe preferência local ou primeiro disponível. Mudança de espaço dispara `refresh`, que lê documento e membros em paralelo. Ao desmontar efeitos, remove assinatura/timer e protege busca inicial contra resposta obsoleta.

`role` vem do membro ativo; ausência implica leitor. `writable` habilita ações para admin/editor. `commit(next,restore?)` bloqueia leitor/gravação simultânea, chama armazenamento, substitui snapshot só após sucesso e fecha diálogo. Erro é propagado ao formulário; conflito também ativa aviso remoto. `safeCommit` converte erro em banner para ações de página. `refresh` recarrega snapshot e participantes; `create` cria espaço remoto; `signOut` encerra sessão real ou remove seleção fictícia da aba.

`humanError` traduz falhas de rede, estrutura ausente e erros Zod serializados; outras mensagens são conservadas. Erros não representam sucesso de gravação. `notify` mostra toast por 4,5 segundos.

A cada 30 segundos consulta documento e participantes, indicando revisão divergente. Atualização manual com formulário aberto pede confirmação para fechá-lo. Não atualizar snapshot silenciosamente enquanto o usuário edita.

## Componentes de apresentação

| Componente | Contrato |
|---|---|
| `Modal` | Título, conteúdo, fechamento e largura opcional. Foca primeiro controle, mantém Tab dentro do diálogo, fecha com Escape e restaura foco anterior. |
| `Field` | Rótulo, conteúdo, dica e classe opcionais; organiza campo. |
| `Empty` | Título, descrição e ação opcional para ausência de registros. |
| `StatusBadge` | Traduz status conhecidos e aplica cor semântica; aceita rótulos derivados como fatura parcial. |
| `Kpi` | Formata valor monetário com rótulo/detalhe/ícone/tom; clicável quando há callback. |
| `EntryTable` | Recebe entradas, estado e membros; mostra categoria, instituição, data e status. `portion` escolhe total/pessoal/terceiro; `categoryId` restringe à categoria ou raiz e `responsible` à pessoa/compartilhado. `showTotals` exibe o resumo opcional. Omite linhas com parcela selecionada zero e exibe categorias/responsáveis somente das divisões selecionadas. Abertura de detalhes usa o registro original via callback. |
| `Progress` | Percentual de consumo; largura limitada entre 0–100%; alerta em 80%, excesso acima de 100%. |

`styles.css` fornece layout e adaptações em 1500, 1200, 1000, 800 e 600 pixels. `theme.css`, importado depois, redefine cores e componentes visuais. As fontes externas possuem alternativas de fonte no CSS. Gráficos usam Recharts e callbacks para acessar os registros do cálculo.

## Páginas em pages.tsx

Todas recebem `PageProps`: estado, membros, mês, permissão de escrita e callbacks para abrir operações/detalhes ou gravar novo estado. As páginas leem projeções de domínio; ações passam pelo `App`.

| Página/função | Comportamento |
|---|---|
| `Dashboard` | Saldo planejado, receitas, gastos pessoais e terceiros, evolução, categorias e próximos vencimentos; abre registros dos cálculos. |
| `Transactions` | Mesma função para Lançamentos e Contas a pagar (`bills=true`); filtros, consulta, exportação e apresentação de compromissos; geração de próximas ocorrências no fluxo de contas. |
| `Cards` | Cartões, limite estimado, faturas e pagamentos da competência selecionada; permite abrir compra/pagamento e desfazer registro de pagamento mediante confirmação. Não executa pagamento bancário. |
| `Thirds` | Obrigações por pessoa/compra, recebimentos, saldo separado, contatos e devoluções. Desfazer recebimento requer ausência de uso e devolução vinculados. |
| `Entities` | Lista bancos ou categorias, com opção de mostrar arquivados e abrir cadastro. |
| `ReturnsHistory` | Auxiliar de terceiros: histórico e desfazimento de devoluções registradas. |
| `Budgets` | Totais de limites e consumo pessoal por categoria principal; progresso/alerta; detalhe de gastos; exclusão e cópia ao próximo mês com substituição por categoria. |
| `Reports` | Competência ou caixa, comparação de dois meses, janela de 3/6/12 meses, recorte equivalente até dia atual e terceiros opcionais. Agrupa por categoria/subcategoria, participante, banco, cartão ou recorrência; seleção limita tabela e CSV. |

Em Transactions, o período filtra por vencimento ou data do lançamento; busca usa descrição sem distinguir maiúsculas, categoria inclui subcategorias, e os demais filtros usam banco, cartão, status calculado e responsável (participante, terceiro ou compartilhado). Os filtros de parte, categoria e responsável se intersectam nas mesmas divisões. A perspectiva escolhe total/pessoal/terceiro; a ordenação por valor usa o valor das divisões selecionadas, também utilizado pela tabela, calendário, totais e CSV. Contas a pagar restringe a despesas sem cartão, mas a lista pode incluir realizadas/canceladas conforme filtros. Há apresentação em lista/calendário, indicadores de pendências e aviso de alertas globais ocultos pelo filtro. Pausar uma série impede nova geração, preservando ocorrências já criadas.

Os filtros e a seleção dos relatórios são locais à página. Totais de receitas/gastos pessoais usam tipos `income/expense`; linhas de terceiros continuam separadas. CSV exporta as linhas filtradas e a perspectiva selecionada. `monthLabel` e `chartMoney` são auxiliares de apresentação de mês e centavos em gráficos.

## Formulários em forms.tsx

`Shared` fornece estado, membros, usuário, `commit`, cancelar e indicador `busy`. `Form` intercepta submit e mostra erro sem descartar os campos; `Footer` bloqueia botões enquanto salva. `BankSelect` mostra bancos ativos ou o arquivado já selecionado. `amountText` formata entrada decimal e `zeroCents` permite zero em campos de uso de terceiros; os demais valores usam `cents` positivo.

| Formulário | Conversão e operação |
|---|---|
| `EntryForm` | Monta receita/despesa, divisões e banco opcional por nome. Para compra nova, recebe total original e divisões da compra inteira, número total de parcelas e registrar a partir da parcela; usa `createPurchaseFromOriginal`. Mostra prévia com cada parcela, fatura, total original e total a registrar antes das categorias. Uma única divisão acompanha automaticamente o total e tem valor somente leitura. Na edição, usa `purchaseOriginal` quando disponível; compras antigas parciais continuam com total cadastrado e `createPurchase`, com conversão explícita que limpa valores para novo preenchimento. Para edição recorrente usa `editSeries`; para série nova gera até final do mês 12 meses à frente. Demais casos inserem/substituem `Entry`. Valida antes de commit. |
| `EntityForm` | Cria/edita/arquiva bancos, contatos, categorias e cartões. Cartão acrescenta titular/banco, limite, fechamento, vencimento e últimos dígitos; categoria acrescenta tipo/pai. |
| `PaymentForm` | Sugere restante e terceiro disponível; gera ID estável durante montagem; chama `payInvoice` com valor, data e banco. |
| `ReceiptForm` | Seleciona obrigações ainda a receber, permite vários vínculos, soma partes e define `replacement` conforme realização/quitação. ID estável; chama `addReceipt`. |
| `RefundForm` | Valor, data e competência do crédito; estorno direto ajusta competência pela data; chama `refundEntry`. |
| `BudgetForm` | Limite de categoria principal de despesa do mês; reaproveita ID do orçamento existente e evita duplicação. |
| `SettleForm` | Atualiza mesmo lançamento pendente com valor/data reais e preserva valor previsto; redistribui divisões proporcionalmente. |
| `ReturnForm` | Limita devolução ao excedente e disponibilidade do vínculo, gera ID estável e acrescenta `Return`. |

Trocar para receita remove cartão e reinicia divisão com categoria de receita. Compra em cartão não usa status/data de quitação direta. Edição de série abrangente exige conservar a data da ocorrência no formulário. Edição de compra inteira passa por exclusão protegida do grupo antes de gerar novas parcelas.

## Autenticação e componentes internos do App

`AuthScreen` possui modos login, cadastro e pedido de recuperação, além do fluxo de nova senha. Usa `signInWithPassword`, `signUp` (nome em metadados), `resetPasswordForEmail` e `updateUser`. Cadastro/recuperação usam origem atual como retorno; senha nova/cadastro têm mínimo de oito caracteres na interface. A entrega de e-mail e URLs permitidas dependem da configuração Supabase. Senhas não integram o documento financeiro.

`Installation` exibe e baixa os arquivos SQL importados como texto pelo Vite (`?raw`), sem executá-los. `SpaceForm` valida nome e chama criação de espaço. `EntryDetail` mostra total, datas, competência, previsão, parcelas, divisões, notas e autor; oferece editar, realizar, estornar e excluir conforme tipo/permissão. Compra agrupada é excluída por todas as parcelas.

`SettingsPage` gerencia participantes e convites para administrador, exportação e restauração de backup, regras resumidas e limpeza/recriação dos exemplos. `action` centraliza ocupação/erro das operações de configurações. Convite é um link copiável, sem envio automático de mensagem. Restauração é detalhada em [banco](banco.md).

## Onde alterar um fluxo

Nova regra financeira: `domain.ts`, testes e SQL quando a regra protege dados persistidos. Novo formulário: `forms.tsx`, caso de `Dialog`/renderização no `App` e callbacks quando necessários. Nova visualização: `pages.tsx` e contrato `PageProps`. Novo acesso remoto: `storage.ts` e migração nova. Mudança visual: layout base ou tema conforme responsabilidade; conferir ambos por causa da ordem de CSS. Toda mudança exige atualizar as seções correspondentes deste guia.

## Faturas e datas no cadastro

A lista de faturas e os pagamentos registrados em Cartões e faturas exibem somente a competência selecionada (e o cartão selecionado, quando houver). Consultar outro mês mostra sua fatura; parcelas futuras permanecem armazenadas para projeções e limite estimado, sem geração por navegação. A lista de próximos vencimentos do painel também restringe suas faturas ao mês selecionado; contas diretas conservam sua consulta de próximos vencimentos. Alertas globais continuam permitindo identificar dívidas reais atrasadas. Nenhum histórico é excluído automaticamente.

O campo Primeira fatura original indica o mês da parcela 1 e permite meses anteriores. A sugestão usa a data de compra e o ciclo do cartão, sem limitar o mês original. Em cadastros novos, a parcela efetiva é o maior número entre a parcela solicitada e a parcela correspondente ao mês atual; períodos anteriores são omitidos sem registrar pagamentos. O mês a persistir é primeira fatura original + parcela efetiva - 1. Se todas as parcelas são anteriores, o formulário explica que não há parcelas a registrar. Na edição, deriva o mês original do mês/número da primeira parcela salva, sem omitir histórico adicional. A escolha manual de fatura permanece preservada ao alterar data/cartão.

## Contador de cartões e sino

O contador do menu Cartões e faturas usa `alertGroups(state, undefined, month).invoices`: somente faturas da competência selecionada com restante positivo e vencimento passado ou até sete dias à frente. Trocar o mês recalcula o número; sem alertas, o selo não aparece. O título do selo explicita esse alcance. O sino continua usando `alertGroups(state)` sem filtro, preservando alertas de contas, receitas e faturas de todos os meses. Não altera obrigações, parcelas ou pagamentos.

## Início do recebimento de terceiros

Os atalhos Registrar recebimento no painel, Recebimento de terceiro nas ações rápidas e Registrar recebimento em Valores a receber ficam acessíveis para editor/administrador mesmo com saldo a receber zero. O cartão do painel explica a necessidade de vincular uma compra. Ao abrir o modal, App consulta as obrigações: com valor a receber, mostra ReceiptForm; sem obrigação, mostra ReceiptGuide com instruções e ações de cadastrar pessoa, abrir nova despesa ou navegar a Lançamentos para vincular uma compra existente. Leitores continuam sem permissão de registro. O guia não grava dinheiro nem cria receita; o recebimento continua exigindo compra e contato vinculados.

## Detalhes coerentes com indicadores

`EntryScope`, definido no domínio e reexportado pelos componentes, transporta `portion` (all/personal/third), `categoryId` e `responsible` opcionais. `PageProps.showEntries(title, entries, scope?)` armazena o escopo no diálogo; App explica a perspectiva e a passa a EntryTable. Saldo e gastos pessoais do painel usam personal; gráficos de categorias e orçamentos usam personal e a categoria raiz; indicadores de contas a pagar preservam a parte selecionada. O gráfico de evolução abre despesas do cálculo mensal e receitas recebidas por data de realização. Detalhes de faturas usam all, conservando compras de terceiros.

A tabela calcula valores sobre divisões, exclui linhas sem valor no escopo e mantém o registro original para consulta/edição ao clicar. Não modifica o documento financeiro. Valores e nomes de terceiros deixam de aparecer em consultas pessoais; compra mista aparece somente com sua parcela pessoal. O cálculo do saldo já excluía terceiros e não foi alterado.
