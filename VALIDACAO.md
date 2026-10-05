# Validação da entrega

Verificações executadas em 02/10/2026, com dados fictícios.

| Ambiente | Resultado |
|---|---|
| TypeScript e compilação de produção | Sem erros; dependências divididas em arquivos menores |
| Testes das regras financeiras | 14 cenários automatizados |
| PostgreSQL local (PGlite) | Migrações, isolamento de espaços, permissões, conflitos, convites, proteção do último administrador, validação monetária, pagamentos parciais, usos de terceiros e bloqueio de excessos |
| Supabase real | Instalação e atualização de convites concluídas com sucesso; acesso anônimo à leitura e à criação bloqueado; Site URL do Auth configurada para http://127.0.0.1:5173; nenhum dado financeiro de teste inserido |
| Navegador | Recebimento de terceiro, pagamento parcial, persistência após recarregar, parcelamento, divisões, erro de um centavo preservando formulário, visões pessoal/terceiros, comparação mensal, navegação do gráfico aos registros |

No exemplo original, a fatura tinha R$ 550, incluindo R$ 50 de terceiro. Receber esses R$ 50 manteve o saldo pessoal de R$ 2.600,10 e criou saldo de terceiros de R$ 50. Registrar pagamento de R$ 150, sendo R$ 50 de terceiros, deixou R$ 400 pendentes, zerou o saldo de terceiros e manteve o saldo pessoal. A situação persistiu após recarregar a página.

No formulário de uma compra de R$ 100 em três parcelas, divisões de R$ 66,67 e R$ 33,32 foram rejeitadas. Corrigir para R$ 33,33 permitiu salvar R$ 33,34, R$ 33,33 e R$ 33,33, preservando as divisões. Durante o teste foi corrigida uma validação que inicialmente permitia gerar parcelas antes de conferir o total distribuído; o teste automatizado agora cobre esse caso.

Os exemplos adicionais permanecem identificados como fictícios e são removíveis em Configurações. Não foram importados dados da planilha.

## Validação que depende do primeiro acesso

O projeto Supabase ainda não possui um usuário criado por esta aplicação. Cadastro, confirmação de e-mail, recuperação e convites com logins reais precisam de um usuário que escolha e digite sua própria senha. As regras de autorização foram verificadas no PostgreSQL; a entrega de e-mails deve ser conferida com seu primeiro login, conforme o README. O endereço padrão de retorno do Auth já foi configurado, sem adicionar permissões com curingas.

Não houve publicação da interface. Para abrir futuramente em outros locais, será necessário hospedar a interface e configurar as URLs do Supabase Auth para esse endereço.
