# Logout

O processo de logout no Minsq é focado em encerrar de forma segura a sessão atual do usuário, limpando vestígios locais no navegador e revogando as permissões diretamente no banco de dados para invalidar tokens de acesso.

## Como Funciona

1. O cliente (frontend) envia uma requisição `POST /logout` para o backend, passando o cookie de `refresh_token` ou enviando-o pelo corpo da requisição.
2. O backend intercepta essa requisição, valida e descriptografa o Token JWT para descobrir qual é o ID da Sessão (`jti`).
3. O backend se comunica com o Supabase para carimbar a data e hora do encerramento daquela sessão específica.
4. Por fim, independentemente de o banco de dados falhar ou ter sucesso, o backend comanda o navegador a deletar forçadamente todos os cookies de autenticação (`token` e `refresh_token`).

## Supabase

A funcionalidade de logout interage com uma única tabela: a tabela **`sessions`**.

Ela não deleta a linha da sessão. Em vez disso, ela aplica um princípio de *Soft Delete* / Invalidação:

- **`revoked_at`**: Esta é a única coluna atualizada no momento do logout. O backend injeta o Timestamp (data e hora exata no formato ISO) do momento em que o usuário clicou em sair. Qualquer requisição futura que tente usar o token dessa sessão será bloqueada, pois o sistema verá que a coluna `revoked_at` não está mais nula.

*(Existe também a rota `/logout-all`, que faz exatamente a mesma coisa, mas varre a tabela `sessions` inteira em busca de sessões ativas do usuário e preenche o `revoked_at` de todas elas de uma vez).*

## Proteções e Segurança

1. **Fail-Safe de Limpeza de Navegador (Try/Catch):**
O fluxo foi desenhado para proteger o lado do usuário antes do servidor. Se por algum motivo de rede o banco Supabase estiver fora do ar e não conseguir preencher a coluna `revoked_at`, o backend vai engolir o erro e executar a limpeza de cookies mesmo assim. Isso evita que o usuário clique em "Sair", receba um "Erro 500 Interno" e fique preso no computador logado (vulnerabilidade grave caso o PC seja público).

2. **Limpeza Completa e Dupla (Wipe-out):**
O backend remove proativamente múltiplos cookies para não deixar rastros:
- `refresh_token` (o token de longa duração responsável por manter o usuário conectado).
- `token` (o access token de vida curta do OAuth, prevenindo que um hacker recupere o PC segundos após o logout e aproveite os últimos 15 minutos do token de acesso).

3. **Rate Limiting de Sessão (Anti-Spam):**
A rota `/logout` é protegida pelo `sessionIpLimiter`. Isso evita que bots ou invasores façam requisições automatizadas massivas fingindo desconectar múltiplos usuários.

4. **Validação de Token (JWT Signature):**
O logout exige um token criptograficamente válido no servidor. Um usuário não pode simplesmente forjar um JSON para revogar a sessão de outra pessoa. Apenas o portador do JWT original (com a assinatura intacta) consegue informar ao servidor qual ID de sessão `jti` deve ser anulado.
