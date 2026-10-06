# Persistência, banco e acesso

[Índice](README.md) · [storage.ts](../src/storage.ts) · [001](../supabase/migrations/001_compasso.sql) · [002](../supabase/migrations/002_convites.sql)

## Cliente e contratos de armazenamento

`supabase` é cliente opcional criado com URL e chave pública do ambiente, persistência de sessão, detecção de sessão na URL e renovação automática de token. As funções remotas usam esse cliente com asserção de existência; o chamador deve garantir configuração e fluxo de login. `check(response)` transforma erro retornado pelo SDK em exceção com sua mensagem.

`Space = { id, name }`; `Snapshot = { data: State, revision: number }`. `DEMO_USER` e `demoMember` representam um administrador fictício, sem autenticação real.

| Função | Entrada, saída e efeito |
|---|---|
| `spaces()` | Consulta `finance_spaces`, seleciona ID/nome e ordena por criação; RLS limita aos espaços acessíveis. |
| `members(spaceId)` | Consulta participantes do espaço, incluindo inativos, e converte snake_case SQL para `Member`. |
| `load(spaceId)` | Consulta única de `data/revision`, aplica `validateState`, converte revisão para número e retorna snapshot; acesso ausente/negado resulta em erro. |
| `save(spaceId, snapshot, data, restore=false)` | Valida dados; chama `finance_save` com revisão esperada; retorna documento validado e nova revisão. |
| `createSpace(name)` | Chama `finance_create_space` com estado vazio e categorias sugeridas; retorna UUID. |
| `invite(spaceId, email, role)` | Chama `finance_invite`; retorna link `location.origin/?invite=token`. Não envia e-mail. |
| `acceptInvite(token)` | Chama `finance_accept_invite`; retorna UUID do espaço aceito. |
| `changeMember(spaceId, member, role, active)` | Chama `finance_set_member`; lança erro se recusado. |
| `getSession()` | Retorna sessão do SDK ou `null` se cliente ausente. |
| `demoLoad()` | Lê snapshot fictício de IndexedDB e valida documento; ausente retorna `null`. |
| `demoSave(snapshot, data)` | Valida e grava exemplos com revisão incrementada, verificando revisão atual na mesma transação. Outra aba causa aborto e erro. |
| `clearDemo()` | Exclui chave fictícia do IndexedDB; não modifica Supabase. |
| `download(name, data, type)` | Cria Blob/URL temporária, dispara download e revoga URL após um segundo. |
| `backup(state, space)` | Baixa JSON formatado, nome sanitizado do espaço e data UTC; envelope descrito abaixo. |

`demoDb()` abre banco `compasso-exemplos`, versão 1, object store `demo`, com chave fixa de espaço fictício. Não é suporte offline para dados reais. `sessionStorage['compasso-demo']` guarda escolha por aba; `localStorage['compasso-space']` guarda último espaço escolhido. A sessão real é gerenciada pelo SDK separadamente.

## Tabelas e isolamento

| Tabela | Chave e conteúdo | Leitura autenticada |
|---|---|---|
| `finance_spaces` | UUID; nome e criação. | Participante ativo do espaço. |
| `finance_members` | PK `(space_id,user_id)`; nome, e-mail, função e `active`; FK para `auth.users`. | Participante ativo do espaço. |
| `finance_documents` | PK/FK `space_id`; revisão, JSONB, atualização e autor da gravação. | Participante ativo do espaço. |
| `finance_invites` | UUID; espaço, e-mail, função, token UUID único, expiração em sete dias, aceitação e criador. | Administrador ativo. |
| `finance_history` | ID identity; espaço/revisão únicos; documento anterior, data e autor da operação que o arquivou. | Administrador ativo. |

Todas habilitam RLS. `authenticated` recebe `SELECT`, sujeito às políticas; `anon` não recebe acesso. Escritas diretas nas tabelas são revogadas para ambos. Índices: participantes ativos por usuário e histórico por espaço/data. Remover acesso altera `active`, preservando identificação histórica.

`compasso_private.role_for` lê função do usuário autenticado e ativo no espaço. `finance_can_read` e `finance_is_admin` expõem verificações usadas nas políticas. As RPCs usam `security definer` e `search_path=''`, com referências qualificadas. Funções privadas não são executáveis diretamente por clientes públicos/autenticados.

## RPCs públicas

| Função PostgreSQL | Argumentos → retorno | Regra principal |
|---|---|---|
| `finance_can_read` | `p_space uuid → boolean` | Pertencimento ativo. |
| `finance_is_admin` | `p_space uuid → boolean` | Função ativa `admin`. |
| `finance_create_space` | `p_name text, p_initial jsonb → uuid` | Login obrigatório; cria espaço, administrador e documento revision 0 em operação atômica. Inicial deve ser validado, sem entries/receipts/payments. |
| `finance_save` | `p_space uuid, p_revision bigint, p_data jsonb, p_restore boolean=false → bigint` | Admin/editor; restauração somente admin. Revisão deve coincidir; valida documento e transições. |
| `finance_invite` | `p_space uuid, p_email text, p_role text → uuid` | Admin; valida e-mail, normaliza para minúsculo e cria token. Função é restringida pelo CHECK da tabela. |
| `finance_accept_invite` | `p_token uuid → uuid` | Login com e-mail confirmado correspondente; token vigente e não utilizado; protege último admin e ativa/atualiza membro. |
| `finance_set_member` | `p_space uuid, p_user uuid, p_role text, p_active boolean → void` | Admin; participante existente; não remove/rebaixa último admin; revogação inutiliza convites pendentes do e-mail. |

Criação, convite, aceitação, gravação e gestão de participantes são operações específicas; o backup financeiro não altera permissões. Clientes leitores podem consultar/exportar dados do espaço, mas não gravar. Qualquer autenticado pode criar um espaço próprio e aceitar um convite válido.

## Gravação atômica e concorrência

1. `finance_save` bloqueia a linha do espaço (`FOR UPDATE`), serializando gravações e mudanças de acesso.
2. Busca a função atual do usuário e bloqueia o documento.
3. Compara `p_revision` com a revisão persistida. Diferença causa `CONFLICT`; nenhum documento é sobrescrito.
4. Executa `validate_document` para conferir formato e integridade.
5. Em gravação comum, compara com snapshot anterior e aplica as proteções de transição.
6. Arquiva documento anterior em `finance_history`, incrementa revisão e grava autor/data. Qualquer falha desfaz a operação inteira.

O `App` detecta conflitos, mantém o formulário e sinaliza atualização remota. Não há merge automático nem repetição cega da gravação. A leitura periódica, a cada 30 segundos, apenas indica revisão diferente e atualiza participantes; o usuário recarrega o estado antes de refazer alterações.

## Validação SQL e funções privadas

| Função | Uso |
|---|---|
| `items(d,k)` | Expande array da coleção em linhas JSONB. |
| `has(d,k,v)` | Confere ID na coleção; referência ausente é permitida. |
| `amount(v)` | Exige número inteiro positivo até 100 bilhões de centavos e retorna bigint. |
| `valid_date(v)` | Confere formato e conversão de data civil; inválida retorna falso. |
| `debt(d,eid,cid)` | Obrigação do terceiro menos estornos. |
| `received(d,eid,cid)` | Recebimentos menos devoluções do vínculo. |
| `available(d,rid,eid,cid)` | Recebimento menos usos e devoluções. |
| `invoice_remaining(d,cid,m)` | Recalcula restante com créditos cronológicos anteriores. |
| `validate_document(d,p_space)` | Confere documento v1, tamanho máximo, coleções, IDs, valores, referências, divisões, datas, categorias, autores/responsáveis, faturas e vínculos. |

O SQL valida a existência de `createdBy`, `ownerId` e `holderId` na lista relacional do espaço. A integridade de um snapshot é diferente da legalidade de sua transição. Em gravações comuns, `finance_save` também verifica:

- Novos recebimentos não ultrapassam o devido ainda não recebido.
- Novos pagamentos não ultrapassam o restante; usos de terceiros respeitam obrigação restante.
- Recebimentos, pagamentos e devoluções existentes não são alterados diretamente: desfazer e registrar novamente, respeitando dependências.
- Novos lançamentos são atribuídos ao usuário atual; autoria de lançamentos existentes é preservada.
- Lançamentos com recebimentos, estornos ou fatura paga não podem ser modificados/excluídos quebrando seus vínculos.
- Novas devoluções não ultrapassam excedente recebido.

Recebimentos e pagamentos novos são avaliados sequencialmente sobre `working`, inicializado com documento anterior. As operações normais da interface gravam cada evento separadamente; integrações futuras que acrescentem compra e recebimento/pagamento em uma única chamada precisam considerar essa ordem e validar a transição.

Em restauração, o banco mantém autorização, revisão e validação integral do documento, mas pula as verificações de transição comum. Isso permite substituir o histórico financeiro por snapshot válido; não concede permissão de escrita ao leitor.

## Backups e migrações

Envelope de backup: `format: 'compasso-backup'`, `version: 1`, `exportedAt`, `spaceName`, `data: State`. Não inclui senha, sessão, membros nem revisão do Supabase. Mesmo assim contém informações financeiras privadas; não versionar backups.

Restauração no `SettingsPage`: limita tamanho de arquivo, confere envelope, valida `data`, pergunta sobre responsáveis desconhecidos, converte vínculos desconhecidos para compartilhados e autores desconhecidos para administrador ativo conforme o código, pede confirmação de substituição, baixa backup atual e chama `commit(data,true)`. As permissões do espaço permanecem. O histórico SQL continua registrando a versão anterior.

Migração 001 instala a estrutura em transação; 002 atualiza as duas funções de convites/participantes. A 001 atual já inclui essas proteções, e a 002 mantém compatibilidade com instalações anteriores. Não reaplicar a 001 em tabelas existentes. Migrações aplicadas não devem ser editadas; qualquer mudança futura deve usar novo arquivo numerado e documentar pré-requisitos/efeitos. Esta documentação não aplica mudanças na nuvem.

Não há interface de navegação/restauração direta de `finance_history`, retenção automática nem paginação do documento nesta versão. Monitorar tamanho do documento e crescimento do histórico ao planejar evolução.

## Metadados do total original da compra

`entries[].purchaseOriginal` é um objeto opcional com `amount` e `allocations`, preservado no documento JSON para reabrir o formulário. Não participa dos totais financeiros ou regras de pagamentos; estes continuam usando `entries[].amount` e `allocations`. Nenhuma migração de banco é necessária: o documento aceita os metadados opcionais. Dados antigos não são convertidos nem recalculados automaticamente.
