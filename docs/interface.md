# Interface e fluxos

[Índice](README.md) · [App](../src/App.tsx) · [páginas](../src/pages.tsx) · [formulários](../src/forms.tsx) · [componentes](../src/components.tsx)

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
| `EntryTable` | Recebe entradas, estado e membros; mostra categoria, instituição, data e status. `portion` escolhe total/pessoal/terceiro. Abertura de detalhes via callback. |
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

Em Transactions, o período filtra por vencimento ou data do lançamento; busca usa descrição sem distinguir maiúsculas, categoria inclui subcategorias, e os demais filtros usam banco, cartão, status calculado e responsável pessoal. A perspectiva escolhe total/pessoal/terceiro; a ordenação por valor usa valor total do registro. Contas a pagar restringe a despesas sem cartão, mas a lista pode incluir realizadas/canceladas conforme filtros. Há apresentação em lista/calendário, indicadores de pendências e aviso de alertas globais ocultos pelo filtro. Pausar uma série impede nova geração, preservando ocorrências já criadas.

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

Em compras novas, a sugestão de fatura nunca antecede o mês atual nem o mês selecionado. A data original da compra pode ser antiga: a parcela inicial deve corresponder à fatura atual ou futura. O campo de mês possui mínimo e validação no envio. Ajustar a fatura manualmente impede que alterações posteriores de data ou cartão sobrescrevam a escolha. Na edição, a fatura existente é preservada e históricos continuam editáveis, sujeitos às proteções de pagamentos e recebimentos.

## Contador de cartões e sino

O contador do menu Cartões e faturas usa `alertGroups(state, undefined, month).invoices`: somente faturas da competência selecionada com restante positivo e vencimento passado ou até sete dias à frente. Trocar o mês recalcula o número; sem alertas, o selo não aparece. O título do selo explicita esse alcance. O sino continua usando `alertGroups(state)` sem filtro, preservando alertas de contas, receitas e faturas de todos os meses. Não altera obrigações, parcelas ou pagamentos.
