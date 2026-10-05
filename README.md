# Compasso · Finanças no seu ritmo

Aplicação web em português para organizar um orçamento individual ou compartilhado. Bancos são identificações dos lançamentos: não existem contas bancárias, saldos por instituição ou transferências entre contas.

## Documentação para programadores

O [guia técnico](docs/README.md) documenta a arquitetura, todos os módulos, os contratos financeiros, o banco, as permissões, os fluxos da interface e a manutenção. A documentação deve acompanhar as mudanças de código no mesmo pull request; o [histórico técnico](docs/historico.md) registra as atualizações.

## Histórico e atualizações

O código é mantido em Git. `main` é a versão estável; cada atualização deve ocorrer em uma branch própria (`feat/`, `fix/`, `chore/` ou `docs/`) e ser apresentada em um pull request antes de sua incorporação. O arquivo `AGENTS.md` registra esse fluxo para trabalhos futuros com agentes. O GitHub Actions executa testes financeiros, testes do banco isolado e construção da aplicação em cada pull request e atualização da `main`, sem acessar os dados reais do Supabase.

Credenciais locais, backups e capturas de tela não entram no repositório. Em outro computador, configure seu próprio `.env.local` conforme `.env.example`.

## Executar no computador

Requer Node.js 22.12 ou superior e internet para acessar os dados reais no Supabase.

```powershell
cd "D:\Codex\Sistema Finanças"
npm install
npm run dev
```

Abra **http://127.0.0.1:5173/**. O projeto já está conectado ao Supabase informado, por meio do arquivo `.env.local`, que não entra no controle de versão. As migrações já foram instaladas nesse projeto e o endereço de retorno do Supabase Auth foi configurado para essa URL. Crie seu acesso, confirme seu e-mail e crie um espaço financeiro. Não envie sua senha a outras pessoas. O modo **Explorar exemplos fictícios** é opcional, separado do Supabase, e pode ser limpo em Configurações.

Para reiniciar depois de fechar o computador, execute `npm run dev` novamente. Os dados reais permanecem na nuvem; apenas o servidor da interface precisa ser iniciado. Use sempre a mesma URL durante o desenvolvimento.

## Configurar outro projeto Supabase

1. Copie `.env.example` para `.env.local` e preencha a URL do projeto e a chave **publishable**. Nunca coloque `secret`, `service_role`, senha do banco ou senha de usuário na interface.
2. Execute `supabase/migrations/001_compasso.sql` no SQL Editor do projeto, uma única vez. A página local `/instalacao` permite baixar o mesmo arquivo. A migração é transacional: uma falha impede uma instalação parcial. Não execute novamente sobre tabelas já criadas.
3. Execute `002_convites.sql` se estiver atualizando uma instalação anterior. Em uma instalação nova, a primeira migração já contém essa proteção; a segunda é compatível e pode ser aplicada.
4. Em **Authentication → URL Configuration**, defina Site URL como `http://127.0.0.1:5173`. Esse endereço é usado na confirmação de e-mail e na recuperação de senha. Se utilizar uma origem diferente, como `http://localhost:5173`, adicione também essa origem aos Redirect URLs permitidos. Evite permissões com curingas amplos.
5. Mantenha a confirmação de e-mail habilitada. Para convites, o e-mail confirmado do login deve ser exatamente o convidado. O envio de confirmação/recuperação depende do serviço de e-mail do projeto Supabase; configure SMTP próprio caso o serviço padrão limite entregas.
6. Reinicie a interface após alterar `.env.local`.

Para acesso futuro em outros computadores, a interface poderá ser hospedada. Será necessário atualizar as URLs autorizadas do Auth. Publicação não faz parte desta entrega.

## Regras financeiras

| Indicador | Cálculo |
|---|---|
| Saldo geral do mês | Receitas próprias recebidas na data de realização, menos gastos pessoais por competência, inclusive pendentes |
| Saldo projetado | Saldo geral mais receitas próprias pendentes do mês |
| Gastos pessoais | Divisões pessoais de despesas e parcelas, menos estornos; exclui cancelados e terceiros |
| A receber de terceiros | Parte de terceiros ainda não recebida, já considerando estornos e devoluções |
| Saldo de terceiros | Recebido menos utilizado em faturas e devolvido |

O saldo é de **planejamento mensal**, não um saldo bancário. Não há transporte automático de sobras. Participantes são pessoas com login; terceiros são contatos externos sem acesso ao espaço.

Uma fatura de R$ 150 pode conter R$ 100 pessoais e R$ 50 de terceiro. Seu gasto pessoal é R$ 100. Receber os R$ 50 cria saldo separado; registrar o pagamento de R$ 150 usando esses R$ 50 reduz a obrigação da fatura e o saldo separado, sem descontar o orçamento outra vez. Apenas vincular um recebimento não quita a fatura. Reembolsos recebidos depois da quitação são identificados como reposição de recursos adiantados e continuam separados.

Valores são inteiros em centavos. R$ 100 em três parcelas resulta em R$ 33,34, R$ 33,33 e R$ 33,33. Divisões por categoria e responsável preservam também seus totais. As parcelas entram no mês da fatura, cuja primeira competência pode ser ajustada. No dia do fechamento ou depois dele, a sugestão avança para o ciclo seguinte. Dias inexistentes são ajustados ao último dia do mês. Datas são tratadas sem conversão de fuso; atrasos usam o dia atual em America/Sao_Paulo.

Estornos são registros vinculados à despesa original. Créditos de faturas são aproveitados cronologicamente nas próximas faturas. Limite disponível é uma estimativa. Juros e tarifas devem ser lançados como despesas separadas. Compras com recebimentos, estornos ou faturas já pagas são protegidas contra edição/exclusão que quebraria seus vínculos; corrija por estorno ou desfaça os registros relacionados antes.

## Relatórios e orçamento

- **Consumo por competência:** despesas diretas no mês do lançamento e parcelas no mês da fatura. Pagamentos de fatura não entram novamente. Receitas usam a data do lançamento e indicam previstas/realizadas.
- **Fluxo de caixa registrado:** apenas realizados na data do pagamento ou recebimento. Faturas aparecem como saída; compras do cartão não aparecem novamente. A parte paga com saldo de terceiros é separada dos recursos próprios.
- **Orçamentos por categoria:** consumo pessoal por competência; excluem terceiros e cancelados. Avisos em 80% e acima de 100%. Copie os limites para o próximo mês quando desejar.

Compare meses completos ou o mesmo número de dias de ambos. Se a base anterior for zero, a variação percentual fica sem base. Gráficos, legendas e tabelas permitem consultar os registros utilizados. Os CSVs respeitam filtros e perspectiva, usam separador `;`, valores com vírgula decimal e proteção contra fórmulas em textos.

## Dados, acesso e backup

React + TypeScript + Vite, Recharts e Zod na interface; Supabase Auth e PostgreSQL na nuvem. Espaços, participantes, convites e versões são tabelas relacionais. Os dados financeiros de cada espaço ficam em um documento JSONB versionado, validado no PostgreSQL. Esta escolha mantém operações relacionadas e restaurações atômicas, com controle de concorrência por revisão. O limite desta versão é **10 MB por espaço**; grandes volumes exigirão normalizar as coleções e paginar consultas.

Todas as leituras usam isolamento por espaço no banco (RLS). Escritas diretas são bloqueadas; funções do PostgreSQL verificam a função do usuário, validam valores e referências e bloqueiam sobrescritas concorrentes. Administrador gerencia participantes e restauração, editor grava dados e leitor consulta/exporta. O último administrador não pode ser removido/rebaixado, inclusive por convite. Remover acesso invalida convites ainda pendentes da pessoa. Nenhuma senha é armazenada no documento financeiro.

Em Configurações, baixe um **backup JSON versionado**. Restauração é exclusiva de administrador, exige confirmação, valida dados antes de salvar e baixa uma cópia anterior. Cada gravação no Supabase também guarda uma revisão anterior. Backups de outro espaço não concedem acesso aos antigos participantes; responsáveis desconhecidos são convertidos em compartilhados mediante confirmação. Guarde backups em local privado: eles contêm dados financeiros.

O modo de exemplos utiliza IndexedDB, exclusivamente para dados fictícios. Não é um modo offline para dados reais. Falhas de gravação mostram erro e mantêm o formulário. Se outra pessoa alterar os dados, atualize antes de tentar salvar novamente.

## Verificações

```powershell
npm test
npm run test:database
npm run build
node --env-file=.env.local scripts/check-cloud.mjs
```

Os testes financeiros verificam salários, pendências, cancelamentos, pagamentos sem duplicidade, splits, parcelas, saldo de terceiros, reembolso posterior, estornos e créditos, recorrências, datas, comparação sem base e exportação. O teste de banco utiliza PostgreSQL via PGlite e valida migração, permissões, isolamento, convites, revogação, último administrador, gravação atômica, conflito e bloqueio de recebimentos/pagamentos excessivos. O teste de nuvem é somente leitura/tentativas anônimas bloqueadas: não cria dados.

Também foram exercitados no navegador os fluxos de recebimento e pagamento parcial com terceiros e a persistência após recarregar. Cadastro, confirmação de e-mail, recuperação e convites com contas reais dependem de você criar seu login e da configuração de entrega de e-mails; senhas não foram inventadas para testar seu projeto.

## Limites desta versão

Sem importação da planilha, integração bancária, conciliação ou saldos por banco, aplicativo móvel, publicação, notificações externas, pagamentos bancários reais ou funcionamento offline. A interface registra manualmente os acontecimentos. Recorrências são geradas até 12 meses à frente; use **Gerar próximas** em Contas a pagar para ampliar. Edições de série preservam ocorrências realizadas. Recebimentos, pagamentos e devoluções não têm edição direta; a correção exige desfazer o registro e registrá-lo novamente, respeitando os vínculos. A exclusão de uma ocorrência recorrente permite que ela seja gerada novamente; cancele a ocorrência para mantê-la fora dos totais permanentemente.

A aplicação não impõe limite fixo de participantes; capacidade, retenção do histórico e cotas de e-mail dependem do plano do seu Supabase. O histórico de revisões cresce a cada gravação; monitore a utilização do projeto. Nesta máquina, o Vitest encerra com código de sucesso, mas informa um aviso de demora ao fechar o processo; as asserções passam.

Referências da autorização no banco: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [funções de banco](https://supabase.com/docs/guides/database/functions).
