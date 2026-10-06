# Histórico da documentação

[Índice](README.md)

## 06/10/2026 — parcelamento mensal sem cartão

Adicionado cadastro único de boletos, carnês e financiamentos com valor por parcela, quantidade original, parcela inicial e próximo vencimento. Gera somente as restantes até o término, mantém a data original no template e registra competência por vencimento. A inicial pode estar paga; futuras ficam pendentes. Edição usa escopos da série e conserva demais pagamentos, numeração e valores previstos. Corrigida a substituição da ocorrência selecionada ao realizá-la junto à edição das próximas. Calendário/CSV identificam a parcela; resumo não oferece geração além do fim.

Validação: 37 testes de domínio/formulário; teste PostgreSQL com gravação/leitura de série finita, duplicidade e numeração inválida; construção TypeScript/Vite. Cobertos início 16/48, 33 ocorrências, fim automático, arredondamento de datas, valor individual em centavos, pagamentos sem consumo duplicado, terceiros separados, edição e revalidação JSON. Sem migração ou dados reais alterados. Documentação de domínio, interface e banco atualizada; arquitetura de persistência, permissões e comandos permanecem compatíveis.

## 05/10/2026 — documentação técnica inicial

Código de referência: `61c169b9f2cfbf73d546f4b01c9fc9e24900128f`.

Criado guia para programadores com inventário completo dos arquivos, arquitetura, tipos e contratos das funções de domínio, armazenamento, tabelas/RPCs, permissões, concorrência, backups, páginas, componentes, formulários, autenticação, estilos, testes e manutenção. Adicionados acesso pelo README e regra em AGENTS para atualizar documentação junto com alterações futuras.

Validação: leitura dos módulos e configurações versionados, revisão de contratos contra implementação, conferência de links locais e revisão do diff. Mudança apenas documental; testes financeiros/banco/build não foram executados nesta entrega. Não houve alteração funcional, aplicação de migração ou publicação em produção.

## Como registrar próximas mudanças

Acrescentar entrada com data, referência de código quando disponível, comportamento alterado, documentos revisados e verificações efetivamente realizadas. Diferenciar validação local, CI e nuvem; omitir credenciais e dados reais. Reescrever a documentação principal para refletir a implementação vigente, mantendo aqui o histórico das mudanças.

## 06/10/2026 — parcelamento pelo total original

Formulário passa a receber total original, quantidade original e parcela inicial, exibindo prévia das faturas e do total efetivamente registrado. Categorias e responsáveis dividem o total original. Centavos e divisões são calculados antes de omitir parcelas anteriores. Metadados opcionais preservam o total original na edição; compras parciais antigas mantêm seus valores até conversão explícita. Revisados domínio, interface e banco. Nenhuma migração ou alteração em dados financeiros reais.

Validação: 24 testes de domínio/formulário, teste PostgreSQL local e build aprovados. No navegador, conferidos cadastro de exemplo iniciando na terceira parcela, valores e faturas da prévia, gravação, persistência após recarregar e reabertura com total original preservado.

## 06/10/2026 — faturas por competência selecionada

Cartões e faturas passa a mostrar somente faturas e pagamentos do mês selecionado, mantendo parcelas previstas para projeções. Cadastro novo não sugere nem aceita fatura inicial de mês passado; compras antigas preservam a data original e começam na competência atual ou futura. Escolha manual de fatura não é sobrescrita pela data/cartão; edição conserva histórico. Documentação de interface e domínio atualizada; esquema, RPCs e persistência não mudaram, sem migração ou exclusão de dados reais.

Validação: 28 testes locais de domínio/formulário e teste PostgreSQL passaram. Construção TypeScript/Vite passou. Regressões cobrem troca de mês, parcelas previstas preservadas, data antiga, limite do novo cadastro, edição histórica e fechamento. Publicação em produção depende de aprovação.

## 06/10/2026 — contador de faturas do mês

Menu Cartões e faturas passa a contar apenas faturas em alerta do mês selecionado, mantendo o sino global. Atualizados domínio e interface. Sem alteração de esquema, RPC, permissões, armazenamento ou regras financeiras; nenhum dado real modificado.

Validação local: 29 testes de domínio/formulário, PostgreSQL e construção TypeScript/Vite passaram. Regressão verifica três alertas globais contra um de outubro, mudança de competência, fatura futura fora da janela e pagamento que elimina o aviso do mês. Links locais conferidos. Publicação em produção aguarda aprovação.

## 06/10/2026 — primeira fatura original e parcela atual

Corrigido bloqueio que impedia escolher a primeira fatura original no passado. O formulário usa esse mês como referência da parcela 1 e omite competências anteriores em novos cadastros, preservando a numeração original. Exemplo fictício: primeira fatura setembro, três parcelas e cadastro em outubro gera 2/3 outubro e 3/3 novembro. Edição reconstrói a referência original sem alterar histórico automaticamente. Revisados domínio e interface; contratos de persistência, banco, permissões, arquitetura e comandos permanecem compatíveis, sem migração.

Validação local: 29 testes de domínio/formulário, PostgreSQL e construção TypeScript/Vite passaram. Regressão usa R$ 289, compra de agosto e primeira fatura setembro para gerar 2/3 outubro e 3/3 novembro, sem gasto em setembro; inclui recuperação da referência original na edição, virada de ano e manutenção da escolha de parcela posterior. Links locais conferidos. Produção aguarda aprovação.

## 06/10/2026 — atalhos de recebimento sem obrigação

Corrigido estado silencioso dos botões de recebimento quando A receber é zero. Atalhos abrem guia com ações de cadastrar pessoa e vincular compra existente/nova; havendo obrigação, abrem formulário normal. Leitores permanecem sem escrita. Documentação de interface atualizada; domínio, regras financeiras, banco, permissões, persistência, arquitetura e comandos seguem compatíveis. Sem migração ou alteração de dados reais.

Validação local: 31 testes de domínio/formulário, PostgreSQL e construção TypeScript/Vite passaram. Regressões verificam atalhos habilitados no painel e Valores a receber com saldo zero, restrições para leitor e guia sem formulário de gravação, com caminho para compra existente. Links locais conferidos. Publicação aguarda aprovação.

## 06/10/2026 — detalhes de indicadores pessoais

Corrigidas listas de composição do saldo e gastos pessoais que mostravam valores integrais de compras de terceiros, apesar de os totais já excluírem esses valores. Escopo de parte/categoria acompanha o diálogo; compras só de terceiros são omitidas e compras mistas mostram somente a parte escolhida. Categorias e orçamentos restringem também as divisões à categoria raiz; indicadores de contas a pagar preservam sua perspectiva. Faturas e consultas totais continuam mostrando obrigações completas. Sem alteração de dados reais, cálculos financeiros ou banco. Revisada interface; domínio, arquitetura de persistência, permissões e comandos continuam corretos.

Validação local: 32 testes de domínio/formulário, PostgreSQL e construção TypeScript/Vite passaram. Regressão verifica exclusão de compra externa, parte pessoal de compra mista, restrição de categoria, consulta total preservada e estado financeiro intacto. Links locais conferidos. Publicação aguarda aprovação.
