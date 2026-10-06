# Documentação técnica do Compasso

Documentação para quem desenvolve, revisa ou mantém o sistema. Revisão inicial em **05/10/2026**, baseada no código do commit `61c169b9f2cfbf73d546f4b01c9fc9e24900128f`. A versão do pacote e do documento financeiro é 1; a revisão de gravação é um contador independente.

## Roteiro de leitura

1. [Arquitetura e mapa dos arquivos](arquitetura.md): camadas, inicialização, ambiente e configurações.
2. [Modelo e regras financeiras](dominio.md): tipos, contratos de todas as funções de domínio e invariantes.
3. [Persistência, banco e acesso](banco.md): operações de armazenamento, tabelas, RPCs, concorrência e backups.
4. [Interface e fluxos](interface.md): componentes, páginas, formulários e autenticação.
5. [Desenvolvimento e manutenção](manutencao.md): comandos, testes, diagnóstico e atualização obrigatória da documentação.
6. [Histórico da documentação](historico.md): mudanças técnicas documentadas e validação desta entrega.

O [README principal](../README.md) orienta instalação e uso. [VALIDACAO.md](../VALIDACAO.md) registra verificações históricas de 02/10/2026; não representa uma execução nova dos testes. [AGENTS.md](../AGENTS.md) estabelece o fluxo de trabalho autorizado.

## Escopo e fonte da verdade

Este guia cobre os módulos TypeScript/TSX, estilos, scripts, migrações e configurações versionados. O código é a fonte da verdade do comportamento; a documentação explica seus contratos, relações e decisões. Arquivos gerados, dependências de terceiros e conteúdo privado de ambiente não são reproduzidos.

Este chat acompanha a documentação. A referência durável fica no repositório e deve ser atualizada no mesmo pull request das mudanças de código. Alterações feitas fora deste chat também precisam seguir essa regra; o chat não detecta modificações externas por conta própria.
