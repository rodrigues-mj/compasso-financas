# Desenvolvimento e manutenção

[Índice](README.md) · [regras do projeto](../AGENTS.md)

## Preparação e comandos

Use Node.js 22.12 ou superior, instale dependências pelo lockfile e configure ambiente conforme [README](../README.md). Não copiar credenciais para documentação.

```powershell
npm ci
npm run dev
```

| Comando | Propósito |
|---|---|
| `npm run dev` | Desenvolvimento em http://127.0.0.1:5173; porta estrita. |
| `npm run build` | Verificação TypeScript e bundle Vite em `dist/`. |
| `npm run preview` | Inspeção local do bundle construído. |
| `npm test` | Uma execução dos cenários de domínio com Vitest. |
| `npm run test:watch` | Vitest durante desenvolvimento. |
| `npm run test:database` | PostgreSQL PGlite isolado; não acessa dados reais. |
| `node --env-file=.env.local scripts/check-cloud.mjs` | Verificação anônima do Supabase configurado; tenta consulta e criação que devem ser recusadas. |

`check-cloud.mjs` exige URL/chave pública do ambiente e verifica ausência de tabela pelo erro `PGRST205`. Não é teste completo de login, e-mail, RLS com usuários reais nem saúde de todos os dados. Na configuração protegida, nenhum registro é criado; se a autorização estivesse incorreta, a tentativa de criação poderia executar. Não usar como substituto de teste isolado.

## Cobertura e limites das verificações

`domain.test.ts` cobre total original, prévia consistente com gravação, omissão de parcelas sem alterar divisões, metadados preservados no JSON e edição, início em parcela intermediária, conservação de centavos/divisões, parcela inicial inválida, alertas de contas/receitas/faturas e outros meses, salários e despesas pendentes, pagamento sem duplicidade, separação/uso de terceiros, excessos, reposição após quitação, estornos/créditos, categorias, fechamento e datas, recorrências, caixa/competência, comparação sem base, arquivamento/JSON e proteção de CSV.

`forms.test.ts` verifica os rótulos do novo cadastro, prévia/total original na reabertura e preservação do modo antigo para compras parciais sem metadados.

`test-database.mjs` cria banco descartável e papéis `anon/authenticated`, simula `auth.users`/`auth.uid()` e aplica a migração 001. Verifica criação/gravação, revisão divergente, escrita direta bloqueada, isolamento de outro usuário, leitor, último admin, e-mail de convite, limites monetários, recebimento/pagamento excessivos, uso de terceiros, restauração, histórico e revogação. O script atual lê **001**, não executa 002 separadamente; as funções protegidas já estão na 001. Não atribuir cobertura independente da 002 a essa execução.

O CI executa `npm ci`, os dois conjuntos de testes e build em PRs e atualizações da main. Ele não acessa produção nem confere entrega de e-mails. Mudanças financeiras, de autenticação, banco ou interface exigem os três comandos de validação do AGENTS. Documentação isolada exige leitura crítica e conferência dos links, sem executar testes desnecessários.

Verificação de interface deve usar exemplos fictícios e cobrir o fluxo modificado, erro preservando campos e persistência após recarregar. Testes com contas reais precisam respeitar autorização e privacidade; nunca registrar senhas/dados financeiros em evidências públicas.

## Atualização obrigatória da documentação

A documentação técnica deve acompanhar cada mudança de código no mesmo conjunto de commits e pull request. A regra fica em `AGENTS.md`, tornando-a visível também em trabalhos futuros fora deste chat.

| Alteração | Seção a revisar |
|---|---|
| Arquivo/dependência/configuração/variável de ambiente | [Arquitetura](arquitetura.md), inventário, requisitos e README de instalação. |
| Tipo, schema, cálculo, parcela, terceiro ou relatório | [Domínio](dominio.md), contratos/invariantes e casos de teste afetados. |
| RPC, tabela, RLS, formato ou migração | [Banco](banco.md), permissões, compatibilidade, implantação autorizada e validação. |
| Página, formulário, autenticação ou comportamento visual | [Interface](interface.md), fluxo, erros e verificação apropriada. |
| Processo, script de validação ou CI | Este guia, AGENTS quando aplicável e evidências de validação. |

Antes de concluir uma alteração: conferir documentação contra diff, atualizar contratos e links, registrar em [histórico](historico.md) o comportamento final, arquivos envolvidos e validação feita. Explicações no PR/chat complementam os arquivos, sem substituir a referência técnica versionada. Quando a mudança não altera nenhum contrato descrito, registrar no PR por que a documentação continua correta.

Não marcar testes como executados sem nova evidência. Preservar registros históricos com suas datas; acrescentar nova verificação em vez de transformar resultado antigo em atual. A referência inicial ao commit em `docs/README.md` deve ser revista quando uma nova versão do código for documentada.

## Fluxo de entrega

1. Verificar branch, Git e `AGENTS.md`; preservar mudanças existentes.
2. Criar branch descritiva `feat/`, `fix/`, `chore/` ou `docs/`; nunca desenvolver diretamente na `main` estável.
3. Implementar e documentar o comportamento final, sem dados reais ou segredos.
4. Executar a validação apropriada e revisar diff/links.
5. Fazer commit com mensagem clara em português, publicar branch e abrir PR com problema, solução e validação; anexar ao chat.
6. Incorporação à main e publicação em produção dependem de autorização explícita.

## Diagnóstico orientado pelo código

| Sintoma | Inspeção recomendada |
|---|---|
| Cliente não configurado | Variáveis em `.env.local`, nomes suportados e reinício do Vite; não exibir chave em logs. |
| Erro de schema cache/tabela ausente | Migrações instaladas no projeto correto e contrato RPC; `humanError` aponta instalação. |
| `CONFLICT`/outra aba alterou | Revisão de `Snapshot`, aviso remoto e atualização explícita antes de refazer operação. |
| Falha de rede ao salvar | Exceção de armazenamento e preservação do formulário; não presumir gravação pelo clique. |
| Convite recusado | Token, sete dias, utilização/revogação, e-mail confirmado e proteção do último administrador. |
| Soma/valor rejeitado | Conversão em `cents`, divisões totais, limite monetário e validação SQL. |
| Fatura ou orçamento inesperado | Competência, fechamento, crédito, estornos, parte pessoal/terceiro e diferença entre caixa e planejamento. |
| Exclusão/edição recusada | Recebimentos, estornos ou pagamento da fatura vinculados; desfazer relações em ordem válida ou usar estorno. |
| Backup recusado | Envelope/version, limite de arquivo, validação de estado e responsáveis do espaço. |

## Decisões que afetam evolução

O documento inteiro facilita gravações e restaurações atômicas, mas amplia custo de leitura, validação e histórico. Não há transporte automático de saldo, integração bancária, conciliação, notificações externas, pagamento real, normalização financeira ou offline real. Recorrências são geradas localmente sob ação da interface, sem agendador no servidor. A disponibilidade de limite do cartão é uma estimativa.

Adicionar regras deve manter concordância entre domínio e SQL sem reescrever migrações aplicadas. Um novo formato de `State`/backup exige estratégia explícita de compatibilidade para documentos existentes, migração numerada quando necessária e atualização deste guia. O esquema v1 atual não possui conversor genérico entre versões.
