# Fluxo de desenvolvimento do Compasso

- A branch `main` representa a versão estável. Após o primeiro commit de instalação, nunca desenvolver diretamente nela.
- Para cada conjunto de mudanças, criar uma branch com prefixo `feat/`, `fix/`, `chore/` ou `docs/` e nome descritivo. Reutilizar uma branch apenas enquanto o mesmo trabalho estiver em andamento.
- Antes de alterar arquivos, verificar a branch, o estado do Git e estas instruções. Preservar mudanças existentes do usuário.
- Fazer commits com descrições claras em português. Publicar a branch e abrir um pull request com o problema, a solução e a validação. Anexar o pull request ao chat quando a ferramenta estiver disponível.
- Não incorporar o pull request à `main` nem publicar em produção sem autorização explícita do usuário. Criar branches, commits, publicar branches e abrir pull requests faz parte do fluxo autorizado.
- Executar `npm test`, `npm run test:database` e `npm run build` para alterações no comportamento financeiro, autenticação, banco ou interface. Para documentação isolada, revisar o conteúdo e os links sem executar testes desnecessários.
- Nunca versionar arquivos `.env`, senhas, tokens, chaves administrativas, backups financeiros ou capturas de tela com dados de usuários. `.env.example` deve conter somente exemplos sem credenciais.
- Migrações já aplicadas não devem ser reescritas: criar uma nova migração numerada. Alterações na nuvem precisam respeitar o escopo autorizado.
- Valores monetários permanecem em centavos. Dinheiro de terceiros nunca entra nas receitas pessoais ou no saldo do orçamento. Pagamentos não duplicam consumo.
- GitHub armazena código. Supabase armazena os dados financeiros; dados reais não devem ser colocados em issues, commits ou pull requests.

