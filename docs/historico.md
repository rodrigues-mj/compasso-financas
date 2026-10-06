# Histórico da documentação

[Índice](README.md)

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
